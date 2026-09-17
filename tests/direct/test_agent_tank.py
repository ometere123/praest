import json


def test_agreement_lifecycle_and_commitment_binding(direct_vm, direct_deploy, direct_alice, direct_bob):
    vault = direct_deploy("contracts/genlayer/PRAESTAgreementVault.py")
    adjudicator = direct_alice
    vault.create_agreement(
        "agreement-1", direct_alice, direct_bob, 1, "terms-hash-1234",
        json.dumps({"source_urls": ["https://status.example"]}),
        json.dumps(["FULFILLED", "BREACHED", "UNDETERMINED"]), 5000, adjudicator,
    )
    with direct_vm.prank(direct_bob):
        vault.accept_agreement("agreement-1")
    with direct_vm.prank(direct_alice):
        vault.submit_evidence("agreement-1", "evidence-1", json.dumps({"items": []}), "evidence-hash-1", "buyer")
        vault.lock_evidence("agreement-1")
        vault.open_dispute("agreement-1", "case-1", "The service was unavailable", "evidence-hash-1")
    case = vault.get_case("case-1")
    assert case["terms_commitment"] == "terms-hash-1234"
    assert case["evidence_commitment"] == "evidence-hash-1"


def test_invalid_verdict_is_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    vault = direct_deploy("contracts/genlayer/PRAESTAgreementVault.py")
    vault.create_agreement("agreement-2", direct_alice, direct_bob, 1, "terms-hash-5678", "{}", json.dumps(["FULFILLED", "UNDETERMINED"]), 1000, direct_alice)
    with direct_vm.prank(direct_bob):
        vault.accept_agreement("agreement-2")
    with direct_vm.prank(direct_alice):
        vault.submit_evidence("agreement-2", "evidence-2", json.dumps({"items": []}), "evidence-hash-2", "buyer")
        vault.lock_evidence("agreement-2")
        vault.open_dispute("agreement-2", "case-2", "claim", "evidence-hash-2")
    with direct_vm.expect_revert("verdict binding mismatch"):
        vault.apply_verdict("case-2", json.dumps({"case_id": "other", "version": 1, "outcome": "FULFILLED", "reason_code": "OK", "remedy_bps": 0}), "verdict-hash")
