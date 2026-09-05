# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import genlayer as gl
from genlayer.types import *


class AgreementRegistry(gl.contract.Contract):
    owner: Address
    agreements: gl.storage.TreeMap[str, str]

    def __init__(self): self.owner = gl.message.sender_address

    @gl.public.write
    def register(self, agreement_id: str, version: int, terms_hash: str, policy_version: int) -> None:
        if gl.message.sender_address != self.owner: raise gl.vm.UserError("only owner")
        if agreement_id in self.agreements: raise gl.vm.UserError("agreement already registered")
        self.agreements[agreement_id] = f"{version}|{terms_hash}|{policy_version}|active"

    @gl.public.write
    def update_version(self, agreement_id: str, version: int, terms_hash: str, policy_version: int) -> None:
        if gl.message.sender_address != self.owner: raise gl.vm.UserError("only owner")
        if agreement_id not in self.agreements: raise gl.vm.UserError("unknown agreement")
        self.agreements[agreement_id] = f"{version}|{terms_hash}|{policy_version}|active"

    @gl.public.view
    def get_agreement(self, agreement_id: str) -> str: return self.agreements.get(agreement_id, "")
