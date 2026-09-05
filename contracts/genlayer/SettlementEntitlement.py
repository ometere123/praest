# v0.3.0
# { "Depends": "py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0" }

import genlayer as gl
from genlayer.types import *
import json


class SettlementEntitlement(gl.contract.Contract):
    owner: Address
    entitlements: gl.storage.TreeMap[str, str]

    def __init__(self): self.owner = gl.message.sender_address

    @gl.public.write
    def record(self, decision_hash: str, outcome: str, remedy_bps: int, policy_version: int) -> None:
        if gl.message.sender_address != self.owner: raise gl.vm.UserError("only owner")
        if decision_hash in self.entitlements: raise gl.vm.UserError("entitlement exists")
        if remedy_bps < 0 or remedy_bps > 10000: raise gl.vm.UserError("invalid remedy")
        self.entitlements[decision_hash] = json.dumps({"outcome": outcome, "remedy_bps": remedy_bps, "policy_version": policy_version}, sort_keys=True)

    @gl.public.view
    def get(self, decision_hash: str) -> dict:
        r = self.entitlements.get(decision_hash, "")
        return json.loads(r) if r else {}
