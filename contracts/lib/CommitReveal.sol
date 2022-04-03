// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

library CommitReveal {
    function commit(bytes32 hash, bytes32[] storage commits) public returns (uint) {
        commits.push(hash);
        return commits.length - 1;
    }

    function isValidReveal(uint id, bytes calldata data, bytes32[] calldata commits) public pure returns (bool) {
        return id < commits.length && commits[id] == keccak256(data);
    }
}