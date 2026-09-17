"""Small direct JSON-RPC reader for PRAEST's GenLayer deployment.

Signing is intentionally left to the caller's wallet or signing environment; this
package never stores a PRAEST API key or server-held private key.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class StudioDev:
    chain_id: int = 61997
    rpc: str = "https://studio-dev.genlayer.com/api"
    explorer: str = "https://explorer-studio-dev.genlayer.com/"


STUDIO_DEV = StudioDev()


class PraestDirectClient:
    """Read GenLayer state directly and submit caller-signed raw transactions."""

    def __init__(self, rpc_url: str = STUDIO_DEV.rpc, timeout: float = 30.0):
        if rpc_url != STUDIO_DEV.rpc:
            raise ValueError(f"PRAEST is locked to {STUDIO_DEV.rpc}")
        self.network = STUDIO_DEV
        self.client = httpx.Client(base_url=rpc_url, timeout=timeout)
        self._next_id = 1

    def rpc(self, method: str, params: list[Any] | None = None) -> Any:
        request_id = self._next_id
        self._next_id += 1
        response = self.client.post("", json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or []})
        response.raise_for_status()
        payload = response.json()
        if payload.get("error"):
            raise RuntimeError(f"GenLayer RPC error: {payload['error']}")
        return payload.get("result")

    def read_contract(self, address: str, data: str, block: str = "finalized") -> str:
        return self.rpc("eth_call", [{"to": address, "data": data}, block])

    def submit_signed(self, raw_transaction: str) -> str:
        return self.rpc("eth_sendRawTransaction", [raw_transaction])

    def explorer_transaction(self, tx_id: str) -> str:
        return f"{STUDIO_DEV.explorer}tx/{tx_id}"

    def close(self) -> None:
        self.client.close()


PraestClient = PraestDirectClient
