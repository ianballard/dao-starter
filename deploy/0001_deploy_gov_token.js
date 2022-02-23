// SPDX-License-Identifier: agpl-3.0

const hre = require("hardhat");

module.exports = async () => {

    const {deployments, getNamedAccounts} = hre;
    const {deployer, contractOwner} = await getNamedAccounts();

    console.log(`Deployer address [${deployer}]`);
    console.log(`Contract owner address [${contractOwner}]`);

    let token = await deployments.deploy('Token', {
        from: deployer,
        owner: deployer,
        args: [
            "DAOToken",
            "DAO"
        ],
        log: true
    });

    console.log(`Token address [${token.address}]`);

    let timelockController = await deployments.deploy('TimelockController', {
        from: deployer,
        owner: deployer,
        // access control: https://docs.openzeppelin.com/contracts/4.x/governance#timelock
        args: [0, [], []],
        log: true
    });

    console.log(`TimelockController address [${timelockController.address}]`);

    let tokenGovernor = await deployments.deploy('TokenGovernor', {
        from: deployer,
        owner: deployer,
        args: [
            token.address,
            timelockController.address,
            6575, // 1 day
            46027, // 1 week
            0
        ],
        log: true
    });

    console.log(`TokenGovernor address [${await tokenGovernor.address}]`);

    //https://docs.openzeppelin.com/defender/guide-timelock-roles
    const proposerRole = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
    const executorRole = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';
    const adminRole = '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5';

    const AccessControlABI = require('../artifacts/@openzeppelin/contracts/access/AccessControl.sol/AccessControl.json').abi;
    let accessControl = await hre.ethers.getContractAt(AccessControlABI, timelockController.address, await hre.ethers.getSigner(deployer));

    // access control: https://docs.openzeppelin.com/contracts/4.x/governance#timelock
    await accessControl.grantRole(proposerRole, tokenGovernor.address);
    await accessControl.grantRole(executorRole, tokenGovernor.address);
    await accessControl.revokeRole(adminRole, deployer);

};

module.exports.tags = ['v0001'];
