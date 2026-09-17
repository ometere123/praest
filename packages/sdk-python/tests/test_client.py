import pytest

from praest import STUDIO_DEV, PraestDirectClient, PraestClient


def test_direct_sdk_is_locked_to_studio_dev():
    assert STUDIO_DEV.chain_id == 61997
    assert STUDIO_DEV.rpc == "https://studio-dev.genlayer.com/api"
    assert PraestClient is PraestDirectClient


def test_other_rpc_is_rejected():
    with pytest.raises(ValueError):
        PraestDirectClient("https://example.invalid")
