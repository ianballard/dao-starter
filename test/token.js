// SPDX-License-Identifier: agpl-3.0

const {expect} = require("chai");
const hre = require("hardhat");

describe("Token", function () {

    let account;
    let accounts;
    let token;

    before(async function () {

        const {deployer} = await hre.getNamedAccounts();
        account = await hre.ethers.getSigner(deployer);

        //Per `hardhat.config.js`, the 0 and 1 index accounts are named accounts. They are reserved for deployment uses
        [, , ...accounts] = await hre.ethers.getSigners();
        
        const {Token} = await hre.deployments.fixture();
        token = await hre.ethers.getContractAt(Token.abi, Token.address, account);

    });


    it("should modify voting power", async () => {

        const sender = account.address;
        const balance = await token.balanceOf(sender);

        let delegate = await token.delegates(sender);

        const zeroAddress = '0x0000000000000000000000000000000000000000'
        expect(delegate).to.equal(zeroAddress, "Should not have delegate set");

        let weight = await token.getVotes(sender);
        expect(weight).to.equal(0, "Should not have any voting power");

        await token.delegate(sender);

        delegate = await token.delegates(sender);
        expect(delegate).to.equal(sender, "Should have delegated self");

        weight = await token.getVotes(sender);
        expect(weight).to.equal(balance.toString(), "Should have voting power equal to balance of token");

        let checkPoints = await token.numCheckpoints(sender);
        expect(checkPoints).to.equal(1, "Should have reached checkpoint");

    });


});
