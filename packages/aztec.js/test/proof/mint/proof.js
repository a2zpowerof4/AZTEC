const { constants } = require('@aztec/dev-utils');
const secp256k1 = require('@aztec/secp256k1');
const BN = require('bn.js');
const { expect } = require('chai');
const { randomHex } = require('web3-utils');

const bn128 = require('../../../src/bn128');
const note = require('../../../src/note');
const proof = require('../../../src/proof/mint');
const proofUtils = require('../../../src/proof/proofUtils');

const validateGroupElement = (xHex, yHex) => {
    const x = new BN(xHex.slice(2), 16);
    const y = new BN(yHex.slice(2), 16);
    expect(x.gt(new BN(0))).to.equal(true);
    expect(y.gt(new BN(0))).to.equal(true);
    expect(x.lt(bn128.curve.p)).to.equal(true);
    expect(y.lt(bn128.curve.p)).to.equal(true);
    const lhs = x
        .mul(x)
        .mul(x)
        .add(new BN(3));
    const rhs = y.mul(y);
    expect(lhs.umod(bn128.curve.p).eq(rhs.umod(bn128.curve.p))).that.equal(true);
};

const validateGroupScalar = (hex, canBeZero = false) => {
    const scalar = new BN(hex.slice(2), 16);
    expect(scalar.lt(bn128.curve.n)).to.equal(true);
    if (!canBeZero) {
        expect(scalar.gt(new BN(0))).to.equal(true);
    }
};

describe('Mint Proof', () => {
    it('should construct a proof with well-formed outputs', async () => {
        const newTotalMinted = 50;
        const oldTotalMinted = 30;
        const mintOne = 10;
        const mintTwo = 10;

        const kIn = [newTotalMinted];
        const kOut = [oldTotalMinted, mintOne, mintTwo];
        const sender = randomHex(20);
        const testNotes = await proofUtils.makeTestNotes(kIn, kOut);

        const { proofData, challenge } = proof.constructProof(testNotes, sender);
        const numNotes = 4;

        expect(proofData.length).to.equal(numNotes);
        expect(challenge.length).to.equal(66);
        validateGroupScalar(challenge);
        proofData.forEach((testNote, i) => {
            validateGroupScalar(testNote[0], i === proofData.length - 1);
            validateGroupScalar(testNote[1]);
            validateGroupElement(testNote[2], testNote[3]);
            validateGroupElement(testNote[4], testNote[5]);
        });
    });

    it('should fail to construct a proof if point NOT on curve', async () => {
        const newTotalMinted = 50;
        const oldTotalMinted = 30;
        const mintOne = 10;
        const mintTwo = 10;

        const kIn = [newTotalMinted];
        const kOut = [oldTotalMinted, mintOne, mintTwo];
        const sender = randomHex(20);
        const testNotes = await proofUtils.makeTestNotes(kIn, kOut);

        testNotes[0].gamma.x = new BN(bn128.curve.p.add(new BN(100))).toRed(bn128.curve.red);
        try {
            proof.constructProof(testNotes, sender);
        } catch (err) {
            expect(err.message).to.contain('NOT_ON_CURVE');
        }
    });

    it('should fail to construct a proof if point at infinity', async () => {
        const newTotalMinted = 50;
        const oldTotalMinted = 30;
        const mintOne = 10;
        const mintTwo = 10;

        const kIn = [newTotalMinted];
        const kOut = [oldTotalMinted, mintOne, mintTwo];
        const sender = randomHex(20);
        const testNotes = await proofUtils.makeTestNotes(kIn, kOut);

        testNotes[0].gamma = testNotes[0].gamma.add(testNotes[0].gamma.neg());
        let message = '';
        try {
            proof.constructProof(testNotes, sender);
        } catch (err) {
            ({ message } = err);
        }
        expect(message).to.contain('POINT_AT_INFINITY');
    });

    it('should fail to construct a proof if viewing key response is 0', async () => {
        const newTotalMinted = 50;
        const oldTotalMinted = 30;
        const mintOne = 10;
        const mintTwo = 10;

        const kIn = [newTotalMinted];
        const kOut = [oldTotalMinted, mintOne, mintTwo];
        const sender = randomHex(20);
        const testNotes = await proofUtils.makeTestNotes(kIn, kOut);

        testNotes[0].a = new BN(0).toRed(bn128.groupReduction);
        try {
            proof.constructProof(testNotes, sender);
        } catch (err) {
            expect(err.message).to.contain('VIEWING_KEY_MALFORMED');
        }
    });

    it('should fail to construct a proof if value > K_MAX', async () => {
        const newTotalMinted = 50;
        const oldTotalMinted = 30;
        const mintOne = 10;
        const mintTwo = 10;

        const kIn = [newTotalMinted];
        const kOut = [oldTotalMinted, mintOne, mintTwo];
        const sender = randomHex(20);
        const testNotes = await proofUtils.makeTestNotes(kIn, kOut);

        testNotes[0].k = new BN(constants.K_MAX + 1).toRed(bn128.groupReduction);
        try {
            proof.constructProof(testNotes, sender);
        } catch (err) {
            expect(err.message).to.contain('NOTE_VALUE_TOO_BIG');
        }
    });

    it('should fail to construct a proof if n < 2', async () => {
        const noteValue = 50;
        const testNote = await note.create(secp256k1.generateAccount().publicKey, noteValue);
        const sender = proofUtils.randomAddress();

        try {
            proof.constructProof(testNote, sender);
        } catch (err) {
            expect(err.message).to.equal('INCORRECT_NOTE_NUMBER');
        }
    });
});
