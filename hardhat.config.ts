import '@nomiclabs/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import { HardhatUserConfig } from "hardhat/types";
import dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 0,
            },
            evmVersion: 'paris'
        }
    },
    networks: {
        hardhat: {
            chainId: 31337
        },
        localhost: {
            url: "http://127.0.0.1:8545"
        },
        // arbitrumSepolia: {
        //     url: "https://arb-sepolia.g.alchemy.com/v2/l6n_J_q6R2mgS1g-K7V7troqBMeQVlAV",
        //     chainId: 421614,
        //     accounts: [process.env.PRIVATE_KEY],
        // }
    }
};