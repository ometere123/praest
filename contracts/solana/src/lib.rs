#![allow(unexpected_cfgs)]

use borsh::{BorshDeserialize, BorshSerialize};
use hyperlane_sealevel_mailbox::mailbox_process_authority_pda_seeds;
use hyperlane_sealevel_message_recipient_interface::{HandleInstruction, MessageRecipientInstruction};
use serializable_account_meta::{SerializableAccountMeta, SimulationReturnData};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    instruction::AccountMeta,
    msg,
    program::{invoke, invoke_signed, set_return_data},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::{clock::Clock, Sysvar},
};
use solana_system_interface::instruction as system_instruction;
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token::instruction as token_instruction;

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

const CONFIG_SEED: &[u8] = b"praest-config";
const ESCROW_SEED: &[u8] = b"praest-escrow";
const MAX_PROCESSED: usize = 64;
const ESCROW_SPACE: usize = 3_200;
const CONFIG_SPACE: usize = 180;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Config {
    pub owner: Pubkey,
    pub mailbox: Pubkey,
    pub ism: Pubkey,
    pub local_domain: u32,
    pub trusted_origin: u32,
    pub trusted_sender: [u8; 32],
    pub paused: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Escrow {
    pub escrow_id: [u8; 32],
    pub agreement_id: [u8; 32],
    pub mint: Pubkey,
    pub payer: Pubkey,
    pub provider: Pubkey,
    pub customer: Pubkey,
    pub max_customer_remedy_bps: u16,
    pub deposited: u64,
    pub remaining: u64,
    pub processed: Vec<[u8; 32]>,
    pub bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub enum PraestInstruction {
    Initialize {
        mailbox: Pubkey,
        ism: Pubkey,
        local_domain: u32,
        trusted_origin: u32,
        trusted_sender: [u8; 32],
    },
    CreateEscrow {
        escrow_id: [u8; 32],
        agreement_id: [u8; 32],
        provider: Pubkey,
        customer: Pubkey,
        max_customer_remedy_bps: u16,
        amount: u64,
    },
    RefundEscrow { escrow_id: [u8; 32] },
    SetPaused { paused: bool },
    SetRoute { origin: u32, sender: [u8; 32], ism: Pubkey },
}

#[derive(Clone, Debug)]
struct Allocation { beneficiary: [u8; 32], amount: u128 }
#[derive(Clone, Debug)]
struct Wire {
    instruction_id: [u8; 32],
    agreement_id: [u8; 32],
    decision_hash: [u8; 32],
    settlement_target: [u8; 32],
    escrow_id: [u8; 32],
    asset: [u8; 32],
    asset_decimals: u8,
    finalized_at: u64,
    expires_at: u64,
    source_domain: u32,
    destination_domain: u32,
    allocations: Vec<Allocation>,
}

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if let Ok(ix) = MessageRecipientInstruction::decode(data) {
        return match ix {
            MessageRecipientInstruction::InterchainSecurityModule => return_ism(program_id, accounts),
            MessageRecipientInstruction::InterchainSecurityModuleAccountMetas => return_ism_metas(program_id),
            MessageRecipientInstruction::Handle(h) => handle(program_id, accounts, h),
            MessageRecipientInstruction::HandleAccountMetas(h) => return_handle_metas(program_id, &h.message),
        };
    }

    let ix = PraestInstruction::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    match ix {
        PraestInstruction::Initialize { mailbox, ism, local_domain, trusted_origin, trusted_sender } =>
            initialize(program_id, accounts, mailbox, ism, local_domain, trusted_origin, trusted_sender),
        PraestInstruction::CreateEscrow { escrow_id, agreement_id, provider, customer, max_customer_remedy_bps, amount } =>
            create_escrow(program_id, accounts, escrow_id, agreement_id, provider, customer, max_customer_remedy_bps, amount),
        PraestInstruction::RefundEscrow { escrow_id } => refund(program_id, accounts, escrow_id),
        PraestInstruction::SetPaused { paused } => admin_update(program_id, accounts, Some(paused), None),
        PraestInstruction::SetRoute { origin, sender, ism } => admin_update(program_id, accounts, None, Some((origin, sender, ism))),
    }
}

fn config_pda(program_id: &Pubkey) -> (Pubkey, u8) { Pubkey::find_program_address(&[CONFIG_SEED], program_id) }
fn escrow_pda(program_id: &Pubkey, id: &[u8; 32]) -> (Pubkey, u8) { Pubkey::find_program_address(&[ESCROW_SEED, id], program_id) }

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo], mailbox: Pubkey, ism: Pubkey, local_domain: u32, trusted_origin: u32, trusted_sender: [u8; 32]) -> ProgramResult {
    let it = &mut accounts.iter();
    let payer = next_account_info(it)?;
    let cfg = next_account_info(it)?;
    let system = next_account_info(it)?;
    if !payer.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    let (key, bump) = config_pda(program_id);
    if cfg.key != &key { return Err(ProgramError::InvalidArgument); }
    invoke_signed(
        &system_instruction::create_account(payer.key, cfg.key, Rent::get()?.minimum_balance(CONFIG_SPACE), CONFIG_SPACE as u64, program_id),
        &[payer.clone(), cfg.clone(), system.clone()],
        &[&[CONFIG_SEED, &[bump]]],
    )?;
    write(cfg, &Config { owner: *payer.key, mailbox, ism, local_domain, trusted_origin, trusted_sender, paused: false })
}

/// Accounts: payer, escrow PDA, mint, payer ATA, vault ATA, SPL token, ATA program, system program.
fn create_escrow(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    id: [u8; 32],
    agreement_id: [u8; 32],
    provider: Pubkey,
    customer: Pubkey,
    max_customer_remedy_bps: u16,
    amount: u64,
) -> ProgramResult {
    if amount == 0 || provider == customer || max_customer_remedy_bps > 10_000 { return Err(ProgramError::InvalidArgument); }
    let it = &mut accounts.iter();
    let payer = next_account_info(it)?;
    let escrow = next_account_info(it)?;
    let mint = next_account_info(it)?;
    let payer_ata = next_account_info(it)?;
    let vault = next_account_info(it)?;
    let token = next_account_info(it)?;
    let ata_program = next_account_info(it)?;
    let system = next_account_info(it)?;
    if !payer.is_signer || token.key != &spl_token::id() { return Err(ProgramError::InvalidArgument); }
    let (key, bump) = escrow_pda(program_id, &id);
    if escrow.key != &key { return Err(ProgramError::InvalidArgument); }
    let expected_payer = get_associated_token_address_with_program_id(payer.key, mint.key, &spl_token::id());
    let expected_vault = get_associated_token_address_with_program_id(&key, mint.key, &spl_token::id());
    if payer_ata.key != &expected_payer || vault.key != &expected_vault { return Err(ProgramError::InvalidArgument); }

    invoke_signed(
        &system_instruction::create_account(payer.key, escrow.key, Rent::get()?.minimum_balance(ESCROW_SPACE), ESCROW_SPACE as u64, program_id),
        &[payer.clone(), escrow.clone(), system.clone()],
        &[&[ESCROW_SEED, &id, &[bump]]],
    )?;
    if vault.data_is_empty() {
        let create = spl_associated_token_account::instruction::create_associated_token_account(payer.key, &key, mint.key, &spl_token::id());
        invoke(&create, &[payer.clone(), vault.clone(), escrow.clone(), mint.clone(), system.clone(), token.clone(), ata_program.clone()])?;
    }
    let transfer = token_instruction::transfer(token.key, payer_ata.key, vault.key, payer.key, &[], amount)?;
    invoke(&transfer, &[payer_ata.clone(), vault.clone(), payer.clone(), token.clone()])?;
    write(escrow, &Escrow {
        escrow_id: id, agreement_id, mint: *mint.key, payer: *payer.key, provider, customer,
        max_customer_remedy_bps, deposited: amount, remaining: amount, processed: Vec::new(), bump,
    })
}

fn refund(program_id: &Pubkey, accounts: &[AccountInfo], id: [u8; 32]) -> ProgramResult {
    let it = &mut accounts.iter();
    let payer = next_account_info(it)?;
    let escrow_info = next_account_info(it)?;
    let mint = next_account_info(it)?;
    let vault = next_account_info(it)?;
    let payer_ata = next_account_info(it)?;
    let token = next_account_info(it)?;
    let mut e: Escrow = read(escrow_info)?;
    let (key, bump) = escrow_pda(program_id, &id);
    if escrow_info.key != &key || payer.key != &e.payer || !payer.is_signer || !e.processed.is_empty() || e.remaining != e.deposited || mint.key != &e.mint || token.key != &spl_token::id() {
        return Err(ProgramError::InvalidArgument);
    }
    if vault.key != &get_associated_token_address_with_program_id(&key, mint.key, &spl_token::id()) || payer_ata.key != &get_associated_token_address_with_program_id(payer.key, mint.key, &spl_token::id()) {
        return Err(ProgramError::InvalidArgument);
    }
    let amount = e.remaining;
    if amount == 0 { return Ok(()); }
    let ix = token_instruction::transfer(token.key, vault.key, payer_ata.key, &key, &[], amount)?;
    invoke_signed(&ix, &[vault.clone(), payer_ata.clone(), escrow_info.clone(), token.clone()], &[&[ESCROW_SEED, &id, &[bump]]])?;
    e.remaining = 0;
    write(escrow_info, &e)
}

fn admin_update(program_id: &Pubkey, accounts: &[AccountInfo], paused: Option<bool>, route: Option<(u32, [u8; 32], Pubkey)>) -> ProgramResult {
    let it = &mut accounts.iter();
    let cfg = next_account_info(it)?;
    let owner = next_account_info(it)?;
    let (key, _) = config_pda(program_id);
    let mut c: Config = read(cfg)?;
    if cfg.key != &key || owner.key != &c.owner || !owner.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    if let Some(p) = paused { c.paused = p; }
    if let Some((origin, sender, ism)) = route { c.trusted_origin = origin; c.trusted_sender = sender; c.ism = ism; }
    write(cfg, &c)
}

fn return_ism(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let cfg = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let (key, _) = config_pda(program_id);
    if cfg.key != &key { return Err(ProgramError::InvalidArgument); }
    let c: Config = read(cfg)?;
    set_return_data(&borsh::to_vec(&Some(c.ism)).map_err(|_| ProgramError::BorshIoError)?);
    Ok(())
}
fn return_ism_metas(program_id: &Pubkey) -> ProgramResult {
    let (key, _) = config_pda(program_id);
    return_metas(vec![AccountMeta::new_readonly(key, false)])
}

/// The returned ordering is exactly the dynamic ordering consumed by handle() after Hyperlane's process-authority account.
/// It intentionally never includes the relayer payer key.
fn return_handle_metas(program_id: &Pubkey, message: &[u8]) -> ProgramResult {
    let w = parse_wire(message)?;
    let (cfg, _) = config_pda(program_id);
    let (escrow, _) = escrow_pda(program_id, &w.escrow_id);
    let mint = Pubkey::new_from_array(w.asset);
    let vault = get_associated_token_address_with_program_id(&escrow, &mint, &spl_token::id());
    let mut metas = vec![
        AccountMeta::new_readonly(cfg, false), AccountMeta::new(escrow, false),
        AccountMeta::new_readonly(mint, false), AccountMeta::new(vault, false),
    ];
    for allocation in &w.allocations {
        let beneficiary = Pubkey::new_from_array(allocation.beneficiary);
        metas.push(AccountMeta::new(get_associated_token_address_with_program_id(&beneficiary, &mint, &spl_token::id()), false));
    }
    metas.push(AccountMeta::new_readonly(spl_token::id(), false));
    return_metas(metas)
}
fn return_metas(metas: Vec<AccountMeta>) -> ProgramResult {
    let serial: Vec<SerializableAccountMeta> = metas.into_iter().map(Into::into).collect();
    let bytes = borsh::to_vec(&SimulationReturnData::new(serial)).map_err(|_| ProgramError::BorshIoError)?;
    set_return_data(&bytes);
    Ok(())
}

fn handle(program_id: &Pubkey, accounts: &[AccountInfo], h: HandleInstruction) -> ProgramResult {
    let it = &mut accounts.iter();
    let authority = next_account_info(it)?;
    let cfg_info = next_account_info(it)?;
    let escrow_info = next_account_info(it)?;
    let mint = next_account_info(it)?;
    let vault = next_account_info(it)?;
    let c: Config = read(cfg_info)?;
    let (cfg, _) = config_pda(program_id);
    if cfg_info.key != &cfg || c.paused || h.origin != c.trusted_origin || h.sender.0 != c.trusted_sender { return Err(ProgramError::InvalidArgument); }
    let (expected_authority, _) = Pubkey::find_program_address(mailbox_process_authority_pda_seeds!(program_id), &c.mailbox);
    if authority.key != &expected_authority || !authority.is_signer { return Err(ProgramError::MissingRequiredSignature); }

    let w = parse_wire(&h.message)?;
    let now = Clock::get()?.unix_timestamp;
    if now < 0 || w.source_domain != h.origin || w.destination_domain != c.local_domain || w.settlement_target != program_id.to_bytes() || w.finalized_at == 0 || w.finalized_at > now as u64 || w.expires_at <= w.finalized_at || now as u64 > w.expires_at {
        return Err(ProgramError::InvalidArgument);
    }

    let (escrow_key, bump) = escrow_pda(program_id, &w.escrow_id);
    if escrow_info.key != &escrow_key || mint.key != &Pubkey::new_from_array(w.asset) || vault.key != &get_associated_token_address_with_program_id(&escrow_key, mint.key, &spl_token::id()) {
        return Err(ProgramError::InvalidArgument);
    }
    let mut e: Escrow = read(escrow_info)?;
    if e.agreement_id != w.agreement_id || e.processed.contains(&w.instruction_id) || e.processed.len() >= MAX_PROCESSED || e.mint != *mint.key {
        return Err(ProgramError::InvalidArgument);
    }

    let mut total: u128 = 0;
    let mut customer_amount: u128 = 0;
    let mut beneficiary_infos = Vec::new();
    for allocation in &w.allocations {
        let account = next_account_info(it)?;
        let beneficiary = Pubkey::new_from_array(allocation.beneficiary);
        let expected = get_associated_token_address_with_program_id(&beneficiary, mint.key, &spl_token::id());
        if account.key != &expected || allocation.amount == 0 || allocation.amount > u64::MAX as u128 || (beneficiary != e.provider && beneficiary != e.customer) {
            return Err(ProgramError::InvalidArgument);
        }
        if beneficiary == e.customer { customer_amount = customer_amount.checked_add(allocation.amount).ok_or(ProgramError::InvalidArgument)?; }
        total = total.checked_add(allocation.amount).ok_or(ProgramError::InvalidArgument)?;
        beneficiary_infos.push((account, allocation.amount as u64));
    }
    let token = next_account_info(it)?;
    if token.key != &spl_token::id() || total > e.remaining as u128 { return Err(ProgramError::InsufficientFunds); }
    let max_customer = (e.deposited as u128 * e.max_customer_remedy_bps as u128) / 10_000;
    if customer_amount > max_customer { return Err(ProgramError::InvalidArgument); }

    // Persist replay/economic state before CPI. Any failed CPI rolls the whole Solana instruction back atomically.
    e.processed.push(w.instruction_id);
    e.remaining -= total as u64;
    write(escrow_info, &e)?;

    for (account, amount) in beneficiary_infos {
        let ix = token_instruction::transfer_checked(token.key, vault.key, mint.key, account.key, &escrow_key, &[], amount, w.asset_decimals)?;
        invoke_signed(&ix, &[vault.clone(), mint.clone(), account.clone(), escrow_info.clone(), token.clone()], &[&[ESCROW_SEED, &w.escrow_id, &[bump]]])?;
    }
    msg!("PRAEST settlement instruction executed");
    Ok(())
}

fn parse_wire(d: &[u8]) -> Result<Wire, ProgramError> {
    if d.len() < 302 || &d[0..4] != b"PRST" || u16::from_be_bytes([d[4], d[5]]) != 1 { return Err(ProgramError::InvalidInstructionData); }
    fn a32(d: &[u8], o: usize) -> [u8; 32] { d[o..o + 32].try_into().unwrap() }
    fn u32b(d: &[u8], o: usize) -> u32 { u32::from_be_bytes(d[o..o + 4].try_into().unwrap()) }
    fn u64b(d: &[u8], o: usize) -> u64 { u64::from_be_bytes(d[o..o + 8].try_into().unwrap()) }
    let n = d[301] as usize;
    if n == 0 || n > 16 || d.len() != 302 + n * 48 { return Err(ProgramError::InvalidInstructionData); }
    let mut allocations = Vec::with_capacity(n);
    let mut o = 302;
    for _ in 0..n {
        allocations.push(Allocation { beneficiary: a32(d, o), amount: u128::from_be_bytes(d[o + 32..o + 48].try_into().unwrap()) });
        o += 48;
    }
    Ok(Wire {
        instruction_id: a32(d, 6), agreement_id: a32(d, 70), decision_hash: a32(d, 102),
        settlement_target: a32(d, 172), escrow_id: a32(d, 204), asset: a32(d, 236), asset_decimals: d[268],
        finalized_at: u64b(d, 269), expires_at: u64b(d, 277), source_domain: u32b(d, 285), destination_domain: u32b(d, 289), allocations,
    })
}

fn read<T: BorshDeserialize>(account: &AccountInfo) -> Result<T, ProgramError> {
    let data = account.data.borrow();
    let mut slice: &[u8] = &data;
    T::deserialize(&mut slice).map_err(|_| ProgramError::InvalidAccountData)
}
fn write<T: BorshSerialize>(account: &AccountInfo, value: &T) -> ProgramResult {
    let bytes = borsh::to_vec(value).map_err(|_| ProgramError::BorshIoError)?;
    if bytes.len() > account.data_len() { return Err(ProgramError::AccountDataTooSmall); }
    account.data.borrow_mut().fill(0);
    account.data.borrow_mut()[..bytes.len()].copy_from_slice(&bytes);
    Ok(())
}
