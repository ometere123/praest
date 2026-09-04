# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json

def _normalize_liability(raw) -> list:
    """Validates structure and enforces sum==10000 when non-empty - a malformed or
    non-conserving allocation from the LLM is treated as no allocation (undetermined-shaped),
    not silently accepted."""
    if not isinstance(raw, list): return []
    items = []
    for entry in raw:
        if not isinstance(entry, dict): continue
        party = entry.get("party")
        bps = entry.get("bps")
        if not isinstance(party, str) or not party: continue
        try: bps = int(bps)
        except (TypeError, ValueError): continue
        if bps < 0 or bps > 10000: continue
        items.append({"party": party, "bps": bps})
    if not items: return []
    if sum(i["bps"] for i in items) != 10000: return []
    return sorted(items, key=lambda i: i["party"])

def _liability_matches(leader: list, other: list) -> bool:
    if len(leader) != len(other): return False
    leader = sorted(leader, key=lambda i: str(i.get("party"))) if leader else []
    other = sorted(other, key=lambda i: str(i.get("party"))) if other else []
    for a, b in zip(leader, other):
        if str(a.get("party")) != str(b.get("party")): return False
        if abs(int(a.get("bps", 0)) - int(b.get("bps", 0))) > 500: return False
    return True

class LiabilityResolver(gl.Contract):
    owner: Address
    resolutions: TreeMap[str, str]
    def __init__(self): self.owner = gl.message.sender_account

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
            prompt = """You are a validator resolving a PRAEST accountability case.
Case type: multi-agent/multi-party causal responsibility attribution and bounded liability allocation
Case ID: {case_id}
Claim: {claim}
Agreement and policy: {agreement}
Evidence manifest commitment: {evidence_manifest_hash}
Validator-fetched observations: {observations}

Decide, from the fetched evidence and agreement terms, which party or parties caused the failure being
claimed and how responsibility should be allocated between them. Party-supplied claims are allegations,
not truth - prefer directly fetched evidence and explicit agreement terms. If the evidence lets you
identify responsible parties with reasonable confidence, allocate their liability in basis points
(bps) so the allocated bps SUM TO EXACTLY 10000 across the identified responsible parties (do not
allocate to parties with no causal link). If evidence is insufficient or conflicting to attribute
causal responsibility, return outcome=undetermined and an empty liability array - do not guess an
allocation you cannot support.
Return JSON only with: outcome (fulfilled|breached|partial|undetermined), reason_code (short uppercase
code), remedy_bps (0..10000 bounded by agreement remedy), policy_version (integer), liability (array
of objects with party (string identifier from the agreement/evidence) and bps (integer 0..10000),
summing to exactly 10000 when non-empty), reasoning (short)."""\
                .format(case_id=case_id, claim=claim, agreement=json.dumps(agreement, sort_keys=True), evidence_manifest_hash=evidence_manifest_hash, observations=json.dumps(observations, sort_keys=True))
            r = gl.nondet.exec_prompt(prompt, response_format="json")
            outcome = str(r.get("outcome", "undetermined")).lower()
            if outcome not in ("fulfilled", "breached", "partial", "undetermined"): outcome = "undetermined"
            max_bps = int(agreement.get("terms", {}).get("remedy", {}).get("maxBps", 10000))
            remedy = max(0, min(max_bps, int(r.get("remedy_bps", 0))))
            liability = _normalize_liability(r.get("liability", []))
            return {"outcome": outcome, "reason_code": str(r.get("reason_code", "UNSPECIFIED"))[:64].upper(), "remedy_bps": remedy, "policy_version": int(r.get("policy_version", 1)), "liability": liability, "reasoning": str(r.get("reasoning", ""))[:1000]}
        def validator_fn(leaders_res):
            if not isinstance(leaders_res, gl.vm.Return):
                try: leader_fn(); return False
                except Exception: return True
            other = leader_fn(); leader = leaders_res.calldata
            if str(leader.get("outcome")) != str(other.get("outcome")): return False
            if abs(int(leader.get("remedy_bps", 0)) - int(other.get("remedy_bps", 0))) > 500: return False
            if int(leader.get("policy_version", 1)) != int(other.get("policy_version", 1)): return False
            # Liability is the decision-bearing field this resolver exists for - independently
            # re-derive it and compare, don't just trust the leader's shape/format.
            if not _liability_matches(leader.get("liability", []), other.get("liability", [])): return False
            return True
        return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

    @gl.public.write
    def resolve(self, case_id: str, agreement_json: str, claim: str, evidence_manifest_json: str, evidence_manifest_hash: str) -> None:
        if gl.message.sender_account != self.owner: raise gl.UserError("only owner")
        if case_id in self.resolutions: raise gl.UserError("case already resolved")
        result = self._resolve(case_id, agreement_json, claim, evidence_manifest_json, evidence_manifest_hash)
        self.resolutions[case_id] = json.dumps(result, sort_keys=True)

    @gl.public.view
    def get_resolution(self, case_id: str) -> dict:
        raw = self.resolutions.get(case_id, "")
        if not raw: return {"outcome":"undetermined","reason_code":"NOT_RESOLVED","remedy_bps":0,"policy_version":1,"liability":[]}
        return json.loads(raw)
