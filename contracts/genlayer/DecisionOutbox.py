# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
class DecisionOutbox(gl.Contract):
    owner: Address
    instructions: TreeMap[str,str]
    order: DynArray[str]
    def __init__(self): self.owner=gl.message.sender_account
    @gl.public.write
    def publish_instruction(self,instruction_id:str,payload_hex:str,decision_hash:str,destination_domain:int,expires_at:int)->None:
        if gl.message.sender_account != self.owner: raise gl.UserError("only owner may publish")
        if expires_at <= 0: raise gl.UserError("invalid expiry")
        if instruction_id in self.instructions: raise gl.UserError("instruction already published")
        if not payload_hex.startswith("0x50525354"): raise gl.UserError("invalid PRAEST payload")
        self.instructions[instruction_id]=json.dumps({"instruction_id":instruction_id,"payload_hex":payload_hex,"decision_hash":decision_hash,"destination_domain":destination_domain,"expires_at":expires_at,"published_by":gl.message.sender_account.as_hex},sort_keys=True)
        self.order.append(instruction_id)
    @gl.public.view
    def get_instruction(self,instruction_id:str)->dict:
        raw=self.instructions.get(instruction_id,"");return json.loads(raw) if raw else {}
    @gl.public.view
    def count(self)->int:return len(self.order)
    @gl.public.view
    def instruction_at(self,index:int)->str:return self.order[index]
