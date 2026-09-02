// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
interface IInterchainSecurityModule { function moduleType() external view returns (uint8); function verify(bytes calldata metadata, bytes calldata message) external returns (bool); }
interface IMailbox { function localDomain() external view returns(uint32); function delivered(bytes32) external view returns(bool); function defaultIsm() external view returns(IInterchainSecurityModule); function dispatch(uint32 destinationDomain,bytes32 recipientAddress,bytes calldata messageBody) external payable returns(bytes32); function quoteDispatch(uint32 destinationDomain,bytes32 recipientAddress,bytes calldata messageBody) external view returns(uint256); }
