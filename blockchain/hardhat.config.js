import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";

/** @type import('hardhat/config').HardhatUserConfig */
export default defineConfig({
  plugins: [hardhatEthers, hardhatMocha, hardhatEthersChaiMatchers],
  solidity: "0.8.24",
  networks: {
    hardhat: {
      type: "edr-simulated"
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545"
    }
  }
});
