import '@nomiclabs/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import { HardhatUserConfig } from "hardhat/types";
import dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.24",
                settings: {
                    optimizer: { enabled: true, runs: 200 },
                    evmVersion: 'paris'
                }
            },
            { version: "0.8.23", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
            { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
            { version: "0.8.19", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
            { version: "0.8.17", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
            { version: "0.8.8",  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
            { version: "0.8.2",  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
            { version: "0.8.0",  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } }
        ]
    },
    networks: {
        hardhat: { chainId: 421610 },
        localhost: { url: "http://91.98.93.77:8545" }
    }
};

export default config;