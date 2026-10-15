import { network } from "hardhat";
import { ethers } from "ethers";

async function main() {
  const { ethers: eth } = await network.create();

  const [deployer, admin, camp, warehouse, transporter] = await eth.getSigners();

  const DisasterReliefAudit = await eth.getContractFactory("DisasterReliefAudit");
  const contract = await DisasterReliefAudit.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("DisasterReliefAudit deployed to:", address);
  console.log("Deployer:", deployer.address);

  const ADMIN_ROLE = await contract.ADMIN_ROLE();
  const WAREHOUSE_ROLE = await contract.WAREHOUSE_ROLE();
  const CAMP_ROLE = await contract.CAMP_ROLE();
  const TRANSPORT_ROLE = await contract.TRANSPORT_ROLE();

  const adminTx = await contract.grantRole(ADMIN_ROLE, admin.address);
  await adminTx.wait();
  if (deployer.address.toLowerCase() !== admin.address.toLowerCase()) {
    const deployerAdminTx = await contract.grantRole(ADMIN_ROLE, deployer.address);
    await deployerAdminTx.wait();
  }
  const warehouseTx = await contract.grantRole(WAREHOUSE_ROLE, warehouse.address);
  await warehouseTx.wait();
  const campTx = await contract.grantRole(CAMP_ROLE, camp.address);
  await campTx.wait();
  const transportTx = await contract.grantRole(TRANSPORT_ROLE, transporter.address);
  await transportTx.wait();

  console.log("Roles granted");
  console.log("ADMIN:", admin.address);
  console.log("WAREHOUSE:", warehouse.address);
  console.log("CAMP:", camp.address);
  console.log("TRANSPORT:", transporter.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
