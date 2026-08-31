import { expect } from "chai";
import hre from "hardhat";
import { network } from "hardhat";
import { ethers } from "ethers";

describe("DisasterReliefAudit", function () {
  let contract, connection;
  let admin, camp, warehouse, transporter, stranger;

  const bytes32 = (s) => ethers.encodeBytes32String(s);

  before(async function () {
    connection = await network.create();
    const { ethers: eth } = connection;

    [admin, camp, warehouse, transporter, stranger] = await eth.getSigners();
    const Factory = await eth.getContractFactory("DisasterReliefAudit");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    const ADMIN_ROLE = await contract.ADMIN_ROLE();
    const WAREHOUSE_ROLE = await contract.WAREHOUSE_ROLE();
    const CAMP_ROLE = await contract.CAMP_ROLE();
    const TRANSPORT_ROLE = await contract.TRANSPORT_ROLE();

    await (await contract.grantRole(ADMIN_ROLE, admin.address)).wait();
    await (await contract.grantRole(WAREHOUSE_ROLE, warehouse.address)).wait();
    await (await contract.grantRole(CAMP_ROLE, camp.address)).wait();
    await (await contract.grantRole(TRANSPORT_ROLE, transporter.address)).wait();
  });

  after(async function () {
    await connection.close();
  });

  it("grants roles correctly", async function () {
    const ADMIN_ROLE = await contract.ADMIN_ROLE();
    expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
    expect(await contract.hasRole(ADMIN_ROLE, stranger.address)).to.equal(false);
  });

  it("creates a request (NONE -> CREATED)", async function () {
    const id = bytes32("req-001");
    await expect(contract.connect(camp).createRequest(id, warehouse.address))
      .to.emit(contract, "RequestCreated");
    const [cw, ww, , status] = await contract.getRequest(id);
    expect(cw).to.equal(camp.address);
    expect(ww).to.equal(warehouse.address);
    expect(status).to.equal(1n); // CREATED
  });

  it("rejects creation by non-camp", async function () {
    const id = bytes32("req-002");
    await expect(contract.connect(stranger).createRequest(id, warehouse.address)).to.revert(ethers);
  });

  it("runs the full happy-path workflow", async function () {
    const id = bytes32("req-003");
    await contract.connect(camp).createRequest(id, warehouse.address);
    await contract.connect(admin).approveRequest(id);
    await contract.connect(warehouse).acceptRequest(id);
    await contract.connect(warehouse).assignTransporter(id, transporter.address);
    await contract.connect(transporter).dispatchRequest(id);
    await contract.connect(transporter).markInTransit(id);
    await contract.connect(transporter).markArrived(id);
    await contract.connect(camp).receiveRequest(id);
    await contract.connect(camp).completeRequest(id);

    const [, , , status, updatedAt] = await contract.getRequest(id);
    expect(status).to.equal(8n); // COMPLETED
    expect(updatedAt).to.be.greaterThan(0n);
  });

  it("rejects invalid transitions", async function () {
    const id = bytes32("req-004");
    await contract.connect(camp).createRequest(id, warehouse.address);
    await expect(contract.connect(admin).acceptRequest(id)).to.revert(ethers);
  });

  it("allows rejection from CREATED by admin", async function () {
    const id = bytes32("req-005");
    await contract.connect(camp).createRequest(id, warehouse.address);
    await contract.connect(admin).rejectRequest(id);
    const [, , , status] = await contract.getRequest(id);
    expect(status).to.equal(9n); // REJECTED
  });
});
