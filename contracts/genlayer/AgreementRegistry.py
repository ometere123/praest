# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
class AgreementRegistry(gl.Contract):
    owner: Address
    agreements: TreeMap[str, str]
    def __init__(self): self.owner = gl.message.sender_account
    @gl.public.write
    def register(self, agreement_id: str, version: int, terms_hash: str, policy_version: int) -> None:
        if gl.message.sender_account != self.owner: raise gl.UserError("only owner")
        if agreement_id in self.agreements: raise gl.UserError("agreement already registered")
        self.agreements[agreement_id] = f"{version}|{terms_hash}|{policy_version}|active"
    @gl.public.write
    def update_version(self, agreement_id: str, version: int, terms_hash: str, policy_version: int) -> None:
        if gl.message.sender_account != self.owner: raise gl.UserError("only owner")
        if agreement_id not in self.agreements: raise gl.UserError("unknown agreement")
        self.agreements[agreement_id] = f"{version}|{terms_hash}|{policy_version}|active"
    @gl.public.view
    def get_agreement(self, agreement_id: str) -> str: return self.agreements.get(agreement_id, "")
