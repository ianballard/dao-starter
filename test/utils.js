/**
 * Force hardhat to mine a block
 * @returns {Promise<void>}
 */
async function mineBlock() {
    console.log(`Increasing time`);
    await hre.ethers.provider.send("evm_increaseTime", [13]);
    console.log(`Mining block`);
    await hre.ethers.provider.send("evm_mine");
    console.log(`Finished mining block`);
}

module.exports = {
    mineBlock
}
