const secp256k1 = require('@aztec/secp256k1');
const BN = require('bn.js');
const crypto = require('crypto');
const { padLeft, toHex } = require('web3-utils');

const bn128 = require('../../bn128');
const note = require('../../note');

const helpers = {};

const generateCommitment = async (k) => {
    const a = padLeft(new BN(crypto.randomBytes(32), 16).umod(bn128.curve.n).toString(16), 64);
    const kHex = padLeft(toHex(Number(k).toString(10)).slice(2), 8);
    const ephemeral = secp256k1.ec.keyFromPrivate(crypto.randomBytes(32));
    const viewingKey = `0x${a}${kHex}${padLeft(ephemeral.getPublic(true, 'hex'), 66)}`;
    return note.fromViewKey(viewingKey);
};

/**
 * Create a set of AZTEC commitments from vectors of input and output values
 * @method generateCommitmentSet
 * @memberof module:joinSplit
 * @param {Object} values
 * @param {number[]} values.kIn vector of input note values
 * @param {number[]} values.kOut vector of output note values
 * @returns {Object} AZTEC commitment array
 */
helpers.generateCommitmentSet = async ({ kIn, kOut }) => {
    const inputs = await Promise.all(
        kIn.map((k) => {
            return generateCommitment(k);
        }),
    );
    const outputs = await Promise.all(
        kOut.map((k) => {
            return generateCommitment(k);
        }),
    );
    const commitments = [...inputs, ...outputs];
    return { commitments, m: inputs.length };
};

// constructs an AZTEC commitment directly from the setup algorithm's trapdoor key.
// Used for testing purposes only; we don't know the trapdoor key for the real deal.
const generateFakeCommitment = async (k, trapdoor) => {
    const commitment = await generateCommitment(k);
    const kBn = new BN(k).toRed(bn128.groupReduction);
    const mu = bn128.h.mul(trapdoor.redSub(kBn).redInvm());
    const gamma = mu.mul(commitment.a);
    const sigma = gamma.mul(kBn).add(bn128.h.mul(commitment.a));
    return {
        ...commitment,
        gamma,
        sigma,
    };
};

/**
 * Create a set of fake AZTEC commitments from vectors of input and output values.
 * This method uses a randomly generated trapdoor key instead of the trusted setup key.
 * @method generateFakeCommitmentSet
 * @memberof module:joinSplit
 * @param {Object} values
 * @param {number[]} values.kIn vector of input note values
 * @param {number[]} values.kOut vector of output note values
 * @returns {Object} AZTEC commitment array
 */
helpers.generateFakeCommitmentSet = async ({ kIn, kOut }) => {
    const trapdoor = new BN(crypto.randomBytes(32), 16).toRed(bn128.groupReduction);
    const inputs = await Promise.all(
        kIn.map((k) => {
            return generateFakeCommitment(k, trapdoor);
        }),
    );
    const outputs = await Promise.all(
        kOut.map((k) => {
            return generateFakeCommitment(k, trapdoor);
        }),
    );
    const commitments = [...inputs, ...outputs];
    return { commitments, m: inputs.length, trapdoor };
};

module.exports = helpers;
