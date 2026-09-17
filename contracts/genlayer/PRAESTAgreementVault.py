# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import json
import genlayer as gl
from genlayer.types import Address


class PRAESTAgreementVault(gl.contract.Contract):
    """Deterministic source of truth for a bounded service agreement."""

    agreements: gl.storage.TreeMap[str, str]
    evidence: gl.storage.TreeMap[str, str]
    evidence_index: gl.storage.TreeMap[str, str]
    cases: gl.storage.TreeMap[str, str]
    receipts: gl.storage.TreeMap[str, str]

    def __init__(self):
        pass

    def _address(self, value: Address) -> str:
        if isinstance(value, bytes):
            return "0x" + value.hex()
        return str(value)

    def _agreement(self, agreement_id: str) -> dict:
        raw = self.agreements.get(agreement_id, "")
        if not raw:
            raise gl.vm.UserError("[EXPECTED] unknown agreement")
        return json.loads(raw)

    @gl.public.write
    def create_agreement(self, agreement_id: str, buyer: Address, provider: Address,
                         version: int, terms_commitment: str, policy_json: str,
                         outcomes_json: str, remedy_bps: int, adjudicator: Address) -> None:
        if agreement_id in self.agreements:
            raise gl.vm.UserError("[EXPECTED] agreement already exists")
        if buyer == provider or version < 1 or len(terms_commitment) < 8:
            raise gl.vm.UserError("[EXPECTED] invalid agreement")
        policy = json.loads(policy_json)
        outcomes = json.loads(outcomes_json)
        if not isinstance(policy, dict) or not isinstance(outcomes, list) or not outcomes or "UNDETERMINED" not in outcomes:
            raise gl.vm.UserError("[EXPECTED] invalid policy")
        if remedy_bps < 0 or remedy_bps > 10000:
            raise gl.vm.UserError("[EXPECTED] invalid remedy")
        self.agreements[agreement_id] = json.dumps({
            "id": agreement_id, "buyer": self._address(buyer), "provider": self._address(provider),
            "version": version, "terms_commitment": terms_commitment,
            "policy": policy, "outcomes": outcomes, "remedy_bps": remedy_bps,
            "adjudicator": self._address(adjudicator), "state": "PROPOSED",
            "accepted": False, "evidence_locked": False, "case_id": "",
            "verdict": "", "receipt": ""
        }, sort_keys=True)

    @gl.public.write
    def accept_agreement(self, agreement_id: str) -> None:
        a = self._agreement(agreement_id)
        if self._address(gl.message.sender_address) != a["provider"] or a["state"] != "PROPOSED":
            raise gl.vm.UserError("[EXPECTED] provider acceptance required")
        a["accepted"] = True
        a["state"] = "ACTIVE"
        self.agreements[agreement_id] = json.dumps(a, sort_keys=True)

    @gl.public.write
    def submit_evidence(self, agreement_id: str, evidence_id: str, manifest_json: str,
                        manifest_commitment: str, role: str) -> None:
        a = self._agreement(agreement_id)
        if not a["accepted"] or a["evidence_locked"] or len(manifest_json) > 12000 or not evidence_id:
            raise gl.vm.UserError("[EXPECTED] evidence window closed")
        if evidence_id in self.evidence:
            raise gl.vm.UserError("[EXPECTED] evidence already exists")
        if role not in ("buyer", "provider", "independent", "browser"):
            raise gl.vm.UserError("[EXPECTED] invalid evidence role")
        manifest = json.loads(manifest_json)
        if not isinstance(manifest, dict) or len(manifest_commitment) < 8:
            raise gl.vm.UserError("[EXPECTED] invalid evidence manifest")
        self.evidence[evidence_id] = json.dumps({
            "agreement_id": agreement_id, "manifest": manifest,
            "commitment": manifest_commitment, "role": role,
            "submitter": self._address(gl.message.sender_address)
        }, sort_keys=True)
        ids = json.loads(self.evidence_index.get(agreement_id, "[]"))
        if len(ids) >= 8:
            raise gl.vm.UserError("[EXPECTED] evidence limit reached")
        ids.append(evidence_id)
        self.evidence_index[agreement_id] = json.dumps(ids, sort_keys=True)

    @gl.public.write
    def lock_evidence(self, agreement_id: str) -> None:
        a = self._agreement(agreement_id)
        if a["state"] != "ACTIVE" or a["evidence_locked"]:
            raise gl.vm.UserError("[EXPECTED] invalid evidence lock")
        a["evidence_locked"] = True
        a["state"] = "DELIVERY"
        self.agreements[agreement_id] = json.dumps(a, sort_keys=True)

    @gl.public.write
    def open_dispute(self, agreement_id: str, case_id: str, claim: str,
                     evidence_commitment: str) -> None:
        a = self._agreement(agreement_id)
        if a["state"] != "DELIVERY" or not claim or not evidence_commitment:
            raise gl.vm.UserError("[EXPECTED] invalid dispute")
        if case_id in self.cases:
            raise gl.vm.UserError("[EXPECTED] case already exists")
        ids = json.loads(self.evidence_index.get(agreement_id, "[]"))
        if not any(json.loads(self.evidence.get(item, "{}" )).get("commitment") == evidence_commitment for item in ids):
            raise gl.vm.UserError("[EXPECTED] evidence commitment not submitted")
        a["state"] = "DISPUTED"
        a["case_id"] = case_id
        self.agreements[agreement_id] = json.dumps(a, sort_keys=True)
        self.cases[case_id] = json.dumps({"agreement_id": agreement_id,
            "version": a["version"], "terms_commitment": a["terms_commitment"],
            "policy": a["policy"], "outcomes": a["outcomes"],
            "remedy_bps": a["remedy_bps"], "claim": claim,
            "evidence_commitment": evidence_commitment, "state": "DISPUTED",
            "verdict": "", "receipt": ""}, sort_keys=True)

    @gl.public.write
    def apply_verdict(self, case_id: str, verdict_json: str, verdict_commitment: str) -> None:
        c_raw = self.cases.get(case_id, "")
        if not c_raw:
            raise gl.vm.UserError("[EXPECTED] unknown case")
        c = json.loads(c_raw)
        if c["state"] != "DISPUTED":
            raise gl.vm.UserError("[EXPECTED] verdict already applied")
        a = self._agreement(c["agreement_id"])
        if self._address(gl.message.sender_address) != a["adjudicator"]:
            raise gl.vm.UserError("[EXPECTED] adjudicator required")
        v = json.loads(verdict_json)
        if v.get("case_id") != case_id or v.get("version") != c["version"]:
            raise gl.vm.UserError("[EXPECTED] verdict binding mismatch")
        if v.get("outcome") not in c["outcomes"] or v.get("remedy_bps", -1) < 0 or v.get("remedy_bps", 10001) > c["remedy_bps"]:
            raise gl.vm.UserError("[EXPECTED] verdict outside policy")
        if not verdict_commitment or not v.get("reason_code"):
            raise gl.vm.UserError("[EXPECTED] incomplete verdict")
        c["state"] = "PROVISIONAL_RESULT"
        c["verdict"] = verdict_json
        self.cases[case_id] = json.dumps(c, sort_keys=True)
        a["state"] = "PROVISIONAL_RESULT"
        a["verdict"] = verdict_commitment
        self.agreements[c["agreement_id"]] = json.dumps(a, sort_keys=True)

    @gl.public.write
    def finalize_case(self, case_id: str, verdict_commitment: str) -> None:
        c_raw = self.cases.get(case_id, "")
        if not c_raw:
            raise gl.vm.UserError("[EXPECTED] unknown case")
        c = json.loads(c_raw)
        if c["state"] != "PROVISIONAL_RESULT":
            raise gl.vm.UserError("[EXPECTED] case is not provisional")
        a = self._agreement(c["agreement_id"])
        if a["verdict"] != verdict_commitment:
            raise gl.vm.UserError("[EXPECTED] finality commitment mismatch")
        c["state"] = "FINALIZED"
        self.cases[case_id] = json.dumps(c, sort_keys=True)
        a["state"] = "FINALIZED"
        self.agreements[c["agreement_id"]] = json.dumps(a, sort_keys=True)

    @gl.public.write
    def materialize_receipt(self, case_id: str) -> str:
        c_raw = self.cases.get(case_id, "")
        if not c_raw:
            raise gl.vm.UserError("[EXPECTED] unknown case")
        c = json.loads(c_raw)
        if c["state"] != "FINALIZED":
            raise gl.vm.UserError("[EXPECTED] finality required")
        if c.get("receipt"):
            raise gl.vm.UserError("[EXPECTED] receipt already materialized")
        a = self._agreement(c["agreement_id"])
        receipt = "receipt:" + case_id + ":" + a["verdict"]
        c["receipt"] = receipt
        self.cases[case_id] = json.dumps(c, sort_keys=True)
        a["receipt"] = receipt
        self.agreements[c["agreement_id"]] = json.dumps(a, sort_keys=True)
        self.receipts[case_id] = json.dumps({"case_id": case_id, "receipt": receipt, "state": "FINALIZED"}, sort_keys=True)
        return receipt

    @gl.public.view
    def get_agreement(self, agreement_id: str) -> dict:
        return self._agreement(agreement_id)

    @gl.public.view
    def get_case(self, case_id: str) -> dict:
        raw = self.cases.get(case_id, "")
        return json.loads(raw) if raw else {"state": "UNKNOWN"}

    @gl.public.view
    def get_receipt(self, case_id: str) -> dict:
        raw = self.receipts.get(case_id, "")
        return json.loads(raw) if raw else {"state": "NOT_MATERIALIZED"}
