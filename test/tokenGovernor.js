// SPDX-License-Identifier: agpl-3.0

const {expect} = require("chai");
const hre = require("hardhat");
const {mineBlock} = require("./utils");
const {abi: AccessControlABI} = require("../artifacts/@openzeppelin/contracts/access/AccessControl.sol/AccessControl.json");

describe("TokenGovernor", function () {

    let signer;
    let accounts;
    let token;
    let timelockController;
    let tokenGovernor;

    before(async function () {

        const {deployer} = await hre.getNamedAccounts();
        signer = await hre.ethers.getSigner(deployer);

        //Per `hardhat.config.js`, the 0 and 1 index accounts are named accounts. They are reserved for deployment uses
        [, , ...accounts] = await hre.ethers.getSigners();

        const {Token} = await hre.deployments.fixture();

        token = await hre.ethers.getContractAt(Token.abi, Token.address, signer);

        const timelockControllerFactory = await hre.ethers.getContractFactory('TimelockController');
        timelockController = await timelockControllerFactory.deploy(0, [], []);
        await timelockController.deployed();

        const tokenGovernorFactory = await hre.ethers.getContractFactory('TokenGovernor');
        tokenGovernor = await tokenGovernorFactory.deploy(token.address, timelockController.address, 0, 10 , 0);
        await tokenGovernor.deployed();

        //https://docs.openzeppelin.com/defender/guide-timelock-roles
        const proposerRole = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
        const executorRole = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';
        const adminRole = '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5';

        const AccessControlABI = require('../artifacts/@openzeppelin/contracts/access/AccessControl.sol/AccessControl.json').abi;
        let accessControl = await hre.ethers.getContractAt(AccessControlABI, timelockController.address, signer);

        // access control: https://docs.openzeppelin.com/contracts/4.x/governance#timelock
        await accessControl.grantRole(proposerRole, tokenGovernor.address);
        await accessControl.grantRole(executorRole, tokenGovernor.address);
        await accessControl.revokeRole(adminRole, deployer);

    });

    async function assertProposalCreated(description) {
        const tokenAddress = token.address;
        const tokenContract = await hre.ethers.getContractAt('ERC20', tokenAddress);
        const calldata = tokenContract.interface.encodeFunctionData('name', []);

        const targets = [tokenAddress];
        const values = [0];

        const calldatas = [calldata];

        const proposalTx = await tokenGovernor.doPropose(
            [tokenAddress],
            [0],
            calldatas,
            description,
        );

        const proposalReceipt = await proposalTx.wait();
        const proposalCreatedEvent = proposalReceipt.events.find(event => event.event === 'ProposalCreated');

        const emittedProposalId = proposalCreatedEvent.args[0].toString()

        const descriptionHash = hre.ethers.utils.id(description);
        const proposalId = await tokenGovernor.hashProposal(targets, values, calldatas, descriptionHash);

        expect(emittedProposalId).to.equal(proposalId, "Unexpected proposal id");
        return {proposalId, targets, values, calldatas, descriptionHash};
    }

    it("should create proposal", async () => {
        const {proposalId} = await assertProposalCreated("Proposal #1: Give grant to receiver");
    });

    async function assertVoteCast(proposalId) {

        await mineBlock()

        let state = await tokenGovernor.state(proposalId);
        const activeState = 1;
        expect(state).to.equal(activeState, "Proposal should be in active state");

        await tokenGovernor.castVote(proposalId, 0);

    }

    it("should cast vote on proposal", async () => {
        const {proposalId} = await assertProposalCreated("Proposal #2: Give grant to receiver some more");

        await assertVoteCast(proposalId);

    });

    it("should execute proposal", async () => {

        const sender = signer.address;

        await token.delegate(sender);

        let delegate = await token.delegates(sender);
        expect(delegate).to.equal(sender, "Should have delegated self");

        const {proposalId, targets, values, calldatas, descriptionHash} =
            await assertProposalCreated("Proposal #3: Give grant to receiver again");

        let state = await tokenGovernor.state(proposalId)
        const pendingState = 0;
        expect(state).to.equal(pendingState, "Proposal should be in pending state");

        await mineBlock()

        state = await tokenGovernor.state(proposalId);
        const activeState = 1;
        expect(state).to.equal(activeState, "Proposal should be in active state");

        const forVote = 1;
        const againstVote = 0;
        const abstainVote = 2;
        const unknownVote = 3;

        await tokenGovernor.castVote(proposalId, forVote);

        const [id, proposer, eta, startBlock, endBlock, forVotes, againstVotes, abstainVotes, canceled, executed] =
            await tokenGovernor.proposals(proposalId);

        const holderVotingPower = await token.getVotes(sender);

        const govBalance = await token.balanceOf(sender);

        expect(holderVotingPower).to.equal(govBalance, "Voting power should equal token balance");

        expect(forVotes).to.equal(holderVotingPower, "Votes 'for' should equal sender's voting power");

        state = await expireVotingPeriod(proposalId);
        const succeededState = 4;
        expect(state).to.equal(succeededState, "Proposal should have succeeded");

        await tokenGovernor.doQueue(targets, values, calldatas, descriptionHash);

        state = await tokenGovernor.state(proposalId);
        const queuedState = 5;
        expect(state).to.equal(queuedState, "Proposal should have been queued");

        await tokenGovernor.doExecute(targets, values, calldatas, descriptionHash);

        state = await tokenGovernor.state(proposalId);
        const executedState = 7;
        expect(state).to.equal(executedState, "Proposal should have been executed");

    });

    async function expireVotingPeriod(proposalId) {
        let state = await tokenGovernor.state(proposalId);
        while (state === 1) {
            await mineBlock();
            state = await tokenGovernor.state(proposalId);
        }
        return state;
    }


});
