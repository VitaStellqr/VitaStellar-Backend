/* eslint-disable no-undef */
/* eslint-disable prettier/prettier */
const StellarSdk = require('stellar-sdk');

const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
const sourceSecretKey = process.env.STELLAR_SECRET_KEY;
const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);

async function submitTransaction(memoText) {
  const account = await server.loadAccount(sourceKeypair.publicKey());
  const fee = await server.fetchBaseFee();

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee,
    networkPassphrase: StellarSdk.Networks.TESTNET,
    memo: StellarSdk.Memo.text(memoText),
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: sourceKeypair.publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: '0',
    }))
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);
  const txResult = await server.submitTransaction(transaction);
  return txResult.hash;
}

async function fetchMemoFromTransaction(txHash) {
  const tx = await server.transactions().transaction(txHash).call();
  return tx.memo;
}

module.exports = {
  submitTransaction,
  fetchMemoFromTransaction,
};
