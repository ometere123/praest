# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
class SettlementEntitlement(gl.Contract):
    owner: Address
    entitlements: TreeMap[str,str]
    def __init__(self): self.owner = gl.message.sender_account
    @gl.public.write
    def record(self, decision_hash:str, outcome:str, remedy_bps:int, policy_version:int)->None:
        if gl.message.sender_account != self.owner: raise gl.UserError("only owner")
        if decision_hash in self.entitlements: raise gl.UserError("entitlement exists")
        if remedy_bps<0 or remedy_bps>10000: raise gl.UserError("invalid remedy")
        self.entitlements[decision_hash]=json.dumps({"outcome":outcome,"remedy_bps":remedy_bps,"policy_version":policy_version},sort_keys=True)
    @gl.public.view
    def get(self,decision_hash:str)->dict:
        r=self.entitlements.get(decision_hash,"");return json.loads(r) if r else {}
