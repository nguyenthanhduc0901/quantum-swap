// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "../../interfaces/IERC20.sol";

/// @title Minimal, gas-efficient ERC20 with EIP-2612 Permit
/// @notice Abstract ERC20 implementation inspired by solmate (gas-optimized), including EIP-2612 permit.
abstract contract ERC20 is IERC20 {
    /*//////////////////////////////////////////////////////////////
                                 METADATA
    //////////////////////////////////////////////////////////////*/

    string public name;
    string public symbol;
    uint8 public immutable decimals;

    /*//////////////////////////////////////////////////////////////
                               ERC20 STORAGE
    //////////////////////////////////////////////////////////////*/

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /*//////////////////////////////////////////////////////////////
                               EIP-2612 STORAGE
    //////////////////////////////////////////////////////////////*/

    bytes32 public immutable DOMAIN_SEPARATOR;
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
    bytes32 public constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint256) public nonces;

    /*//////////////////////////////////////////////////////////////
                                 CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(_name)),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    /*//////////////////////////////////////////////////////////////
                                  ERC20 LOGIC
    //////////////////////////////////////////////////////////////*/

    function approve(address spender, uint256 value) public virtual returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) public virtual returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "ERC20: INSUFFICIENT_ALLOWANCE");
            unchecked {
                allowance[from][msg.sender] = allowed - value;
            }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal virtual {
        require(to != address(0), "ERC20: TRANSFER_TO_ZERO");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: INSUFFICIENT_BALANCE");
        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    /*//////////////////////////////////////////////////////////////
                                  MINT/BURN
    //////////////////////////////////////////////////////////////*/

    function _mint(address to, uint256 value) internal virtual {
        require(to != address(0), "ERC20: MINT_TO_ZERO");
        unchecked {
            totalSupply += value;
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal virtual {
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: BURN_EXCEEDS_BALANCE");
        unchecked {
            balanceOf[from] = fromBalance - value;
            totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }

    /*//////////////////////////////////////////////////////////////
                                 EIP-2612 PERMIT
    //////////////////////////////////////////////////////////////*/

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        require(block.timestamp <= deadline, "ERC20: PERMIT_DEADLINE_EXPIRED");

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        PERMIT_TYPEHASH,
                        owner,
                        spender,
                        value,
                        nonces[owner]++,
                        deadline
                    )
                )
            )
        );

        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, "ERC20: INVALID_PERMIT");

        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}



