# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import genlayer as gl
from genlayer.types import *
import json


class EventResolver(gl.contract.Contract):
    owner: Address
    resolutions: gl.storage.TreeMap[str, str]

    def __init__(self): self.owner = gl.message.sender_address

    def _resolve(self, case_id: str, agreement_json: str, claim: str, evidence_manifest_json: str, evidence_manifest_hash: str) -> dict:
        agreement = json.loads(agreement_json)
        manifest = json.loads(evidence_manifest_json) if evidence_manifest_json else {}
        urls = []
        service = agreement.get("service", {})
        for key in ("baseUrl", "statusPageUrl"):
            u = service.get(key)
            if isinstance(u, str) and u.startswith("https://"): urls.append(u)
        policy_urls = agreement.get("terms", {}).get("evidencePolicy", {}).get("publicUrls", [])
        for u in policy_urls:
            if isinstance(u, str) and u.startswith("https://") and u not in urls: urls.append(u)
        for item in manifest.get("items", []):
            u = item.get("url")
            if isinstance(u, str) and u.startswith("https://") and u not in urls: urls.append(u)
        urls = urls[:6]
        def leader_fn():
            observations = []
            for u in urls:
                try:
                    text = gl.nondet.web.render(u, mode="text")
                    observations.append({"url": u, "content": text[:12000]})
                except Exception as e:
                    observations.append({"url": u, "error": "fetch_failed"})
            condition = agreement.get("terms", {}).get("eventCondition") or claim
            prompt = """You are a validator resolving a PRAEST event/prediction case - a narrow,
binary factual question about the real world (e.g. "did X occur by date Y", "did team A win",
"was proposal N passed"), NOT a service-quality or contractual-compliance judgment. Answer only
the specific factual question below; do not weigh service quality, intent, or fault.
Case ID: {case_id}
Resolution condition (the exact factual question to answer): {condition}
Claimed answer: {claim}
Agreement/policy (only relevant for remedy bounds): {agreement}
Evidence manifest commitment: {evidence_manifest_hash}
Validator-fetched observations (public sources only - treat as the primary evidence): {observations}

Determine, from the fetched observations, whether the specific factual condition occurred/is true.
This is a binary fact, not a matter of degree - use "partial" ONLY if the condition itself is
genuinely ambiguous or has a partial/conditional resolution rule in the agreement, not because
evidence is merely imperfect (use undetermined for that). If public sources conflict or are
insufficient to establish the fact with reasonable confidence, return undetermined - never guess.
Return JSON only with: outcome (fulfilled = condition is TRUE/occurred | breached = condition is
FALSE/did not occur | partial = genuinely partial/conditional per the agreement's own rule |
undetermined = evidence insufficient), reason_code (short uppercase code), remedy_bps (10000 if
fulfilled, 0 if breached, unless the agreement's remedy terms specify otherwise - 0..10000 bounded
by agreement remedy), policy_version (integer), liability (empty array - liability is not a
concept for factual event resolution), reasoning (short, citing which observation established the
fact).""".format(case_id=case_id, condition=condition, claim=claim, agreement=json.dumps(agreement, sort_keys=True), evidence_manifest_hash=evidence_manifest_hash, observations=json.dumps(observations, sort_keys=True))
            r = gl.nondet.exec_prompt(prompt, response_format="json")
            outcome = str(r.get("outcome", "undetermined")).lower()
            if outcome not in ("fulfilled", "breached", "partial", "undetermined"): outcome = "undetermined"
            max_bps = int(agreement.get("terms", {}).get("remedy", {}).get("maxBps", 10000))
            default_bps = max_bps if outcome == "fulfilled" else 0
            remedy = max(0, min(max_bps, int(r.get("remedy_bps", default_bps))))
            return {"outcome": outcome, "reason_code": str(r.get("reason_code", "UNSPECIFIED"))[:64].upper(), "remedy_bps": remedy, "policy_version": int(r.get("policy_version", 1)), "liability": [], "reasoning": str(r.get("reasoning", ""))[:1000]}
        def validator_fn(leaders_res):
            if not isinstance(leaders_res, gl.vm.Return):
                try: leader_fn(); return False
                except Exception: return True
            other = leader_fn(); leader = leaders_res.calldata
            if str(leader.get("outcome")) != str(other.get("outcome")): return False
            if abs(int(leader.get("remedy_bps", 0)) - int(other.get("remedy_bps", 0))) > 500: return False
            if int(leader.get("policy_version", 1)) != int(other.get("policy_version", 1)): return False
            return True
        return gl.vm.run_nondet_default(leader_fn, validator_fn)

    @gl.public.write
    def resolve(self, case_id: str, agreement_json: str, claim: str, evidence_manifest_json: str, evidence_manifest_hash: str) -> None:
        if gl.message.sender_address != self.owner: raise gl.vm.UserError("only owner")
        if case_id in self.resolutions: raise gl.vm.UserError("case already resolved")
        result = self._resolve(case_id, agreement_json, claim, evidence_manifest_json, evidence_manifest_hash)
        self.resolutions[case_id] = json.dumps(result, sort_keys=True)

    @gl.public.view
    def get_resolution(self, case_id: str) -> dict:
        raw = self.resolutions.get(case_id, "")
        if not raw: return {"outcome":"undetermined","reason_code":"NOT_RESOLVED","remedy_bps":0,"policy_version":1,"liability":[]}
        return json.loads(raw)
