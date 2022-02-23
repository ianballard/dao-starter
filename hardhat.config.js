require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
const {TASK_DEPLOY_MAIN} = require('hardhat-deploy');
require('dotenv').config();

const { INFURA_PROJECT_ID, ETH_ACCOUNT_DEPLOYER_PRIVATE_KEY, ALCHEMAPI_API_KEY, ETH_ACCOUNT_DEPLOYER_ADDRESS} = process.env;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    networks: {
        hardhat: {
            forking: {
                url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMAPI_API_KEY}`,
                blockNumber: 14058640
            },
            timeout: 30000,
        },
        localhost: {
            url: "http://127.0.0.1:7545"
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
            accounts: [ETH_ACCOUNT_DEPLOYER_PRIVATE_KEY]
        },
        mainnet_cloudflare: {
            url: "https://cloudflare-eth.com"
        }
    },
    solidity: {
        version: "0.8.12",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    namedAccounts: {
        deployer: {
            default: 0, //For tests and hardhat network, use accounts[0]
            1: '',
            rinkeby: ETH_ACCOUNT_DEPLOYER_ADDRESS,
        },
        contractOwner: {
            default: 1, //For tests and hardhat network, use accounts[1]
            1: '',
            rinkeby: ETH_ACCOUNT_DEPLOYER_ADDRESS,
        }
    },
    mocha: {
        timeout: 30000
    }
};

task("test")
    .setAction(async (taskArgs, hre, runSuper) => {
        console.log(`Running tests within ${hre.config.paths.tests}`);

        taskArgs["deployFixture"] = true;
        return await runSuper(taskArgs);
    });

/**
 * Added this hook into the hardhat deploy plugin to automatically write log output to the corresponding network's
 * deployment folder
 */
subtask(TASK_DEPLOY_MAIN, async (taskArgs, hre, runSuper) => {
    const networkName = hre.network.name;
    const manifestPath = path.join(process.cwd(), "deployments", networkName, ".manifest.json");

    // Get deployedCount
    let deployedCount = 0;
    fs.promises.readFile(manifestPath)
        .then(function (buffer) {
            let content = JSON.parse(buffer.toString());
            deployedCount = parseInt(content["deployedCount"]);
        })
        .catch(function () {
        });

    // Run deployment
    const taskResult = await runSuper(taskArgs);

    // Persist deployedCount
    if (networkName !== "hardhat") {
        let content = JSON.stringify({
            "deployedCount": ++deployedCount
        });
        await fs.promises.writeFile(manifestPath, content);
    }

    return taskResult;
});
