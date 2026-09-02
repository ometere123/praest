# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
class EvidenceAssessor(gl.Contract):
    owner: Address
    assessments: TreeMap[str, str]
    def __init__(self): self.owner = gl.message.sender_account
    @gl.public.write
    def assess(self, bundle_id: str, manifest_json: str) -> None:
        if gl.message.sender_account != self.owner: raise gl.UserError("only owner")
        manifest=json.loads(manifest_json)
        def leader_fn():
            sources=[]
            for i in manifest.get("items", [])[:8]:
                u=i.get("url")
                if isinstance(u,str) and u.startswith("https://"):
                    try: sources.append({"url":u,"text":gl.nondet.web.render(u,mode="text")[:8000]})
                    except Exception: sources.append({"url":u,"error":"fetch_failed"})
            r=gl.nondet.exec_prompt("Assess whether this evidence set is sufficient, relevant and internally consistent for adjudication. Return JSON only with sufficient:boolean, conflicts:boolean, reason_code:string. Manifest: "+json.dumps(manifest,sort_keys=True)+" Sources: "+json.dumps(sources,sort_keys=True),response_format="json")
            return {"sufficient":bool(r.get("sufficient",False)),"conflicts":bool(r.get("conflicts",False)),"reason_code":str(r.get("reason_code","UNSPECIFIED"))[:64].upper()}
        def validator_fn(res):
            if not isinstance(res,gl.vm.Return): return False
            other=leader_fn(); return bool(res.calldata.get("sufficient"))==other["sufficient"] and bool(res.calldata.get("conflicts"))==other["conflicts"]
        self.assessments[bundle_id]=json.dumps(gl.vm.run_nondet_unsafe(leader_fn,validator_fn),sort_keys=True)
    @gl.public.view
    def get_assessment(self,bundle_id:str)->dict:
        r=self.assessments.get(bundle_id,""); return json.loads(r) if r else {"sufficient":False,"conflicts":False,"reason_code":"NOT_ASSESSED"}
