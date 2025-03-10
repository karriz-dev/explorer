/*
 *
 * Copyright (c) 2019-present for NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License ");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { Address, TransactionType, TransactionGroup, Order, BlockOrderBy, ReceiptType, Mosaic, MosaicId } from 'symbol-sdk';
import nem from 'nem-sdk';
import http from './http';
import { Constants } from '../config';
import { NamespaceService, TransactionService, ChainService, MetadataService, LockService, ReceiptService, MosaicService, BlockService } from '../infrastructure';
import helper from '../helper';
import NodeService from './NodeService';

class AccountService {
	/**
	 * Gets an AccountInfo for an account.
	 * @param address
	 * @returns Formatted AccountInfo
	 */
	static getAccount = async address => {
		const account = await http.createRepositoryFactory.createAccountRepository()
			.getAccountInfo(Address.createFromRawAddress(address))
			.toPromise();

		const formattedAccount = this.formatAccountInfo(account);

		return formattedAccount;
	}

	/**
	 * Gets an AccountInfo for an account.
	 * @param addresses Array
	 * @returns Formatted AccountInfo
	 */
	static getAccounts = async addresses => {
		const accounts = await http.createRepositoryFactory.createAccountRepository()
			.getAccountsInfo(addresses.map(a => Address.createFromRawAddress(a)))
			.toPromise();

		return accounts.map(a => this.formatAccountInfo(a));
	}

	/**
	 * Gets a accounts list from searchCriteria
	 * @param accountSearchCriteria Object of Search Criteria
	 * @returns formatted account data with pagination info
	 */
	static searchAccounts = async (accountSearchCriteria) => {
		const searchAccounts = await http.createRepositoryFactory.createAccountRepository()
			.search(accountSearchCriteria)
			.toPromise();

		return {
			...searchAccounts,
			data: searchAccounts.data.map(account => this.formatAccountInfo(account))
		};
	}

	/**
	 * Get custom Account list dataset into Vue Component
	 * @param pageInfo - pagination info
	 * @param filterVaule - object for search criteria
	 * @returns Custom AccountInfo[]
	 */
	static getAccountList = async (pageInfo, filterVaule) => {
		const { pageNumber, pageSize } = pageInfo;
		const searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc
		};

		// Prevent new MosaicId throw error if mosaicId is undefined
		if (filterVaule.mosaicId) {
			Object.assign(searchCriteria, {
				...filterVaule,
				mosaicId: new MosaicId(filterVaule.mosaicId)
			});
		}

		const accountInfos = await this.searchAccounts(searchCriteria);

		const addresses = accountInfos.data.map(accountInfo => Address.createFromRawAddress(accountInfo.address));

		const accountNames = await NamespaceService.getAccountsNames(addresses);

		const { numAccounts } = await NodeService.getStorageInfo();

		return {
			...accountInfos,
			totalRecords: numAccounts,
			data: accountInfos.data.map((account) => ({
				...account,
				balance: helper.getNetworkCurrencyBalance(account.mosaics) !== Constants.Message.UNAVAILABLE ? helper.getNetworkCurrencyBalance(account.mosaics) : helper.toNetworkCurrency(0),
				accountAliasNames: this.extractAccountNamespace(account, accountNames)
			}))
		};
	}

	/**
	 * Get custom Account info dataset into Vue Component
	 * @param address - Account address
	 * @returns Custom AccountInfo
	 */
	static getAccountInfo = async address => {
		const [ { supplementalPublicKeys, ...accountInfo }, accountNames, { latestFinalizedBlock } ] = await Promise.all([
			this.getAccount(address),
			NamespaceService.getAccountsNames([Address.createFromRawAddress(address)]),
			ChainService.getChainInfo()
		]);

		const getVotingEpochStatus = (startEpoch, endEpoch) => {
			let votingStatus = '';

			if (latestFinalizedBlock.finalizationEpoch >= startEpoch && latestFinalizedBlock.finalizationEpoch <= endEpoch)
				votingStatus = Constants.EpochStatus.CURRENT;

			else if (latestFinalizedBlock.finalizationEpoch < startEpoch)
				votingStatus = Constants.EpochStatus.FUTURE;

			else if (latestFinalizedBlock.finalizationEpoch > endEpoch)
				votingStatus = Constants.EpochStatus.EXPIRED;

			return votingStatus;
		};

		return {
			...accountInfo,
			activityBucket: accountInfo.activityBucket.map(activity => ({
				...activity,
				recalculationBlock: activity.startHeight,
				totalFeesPaid: helper.toNetworkCurrency(activity.totalFeesPaid),
				importanceScore: activity.rawScore
			})),
			supplementalPublicKeys: {
				...supplementalPublicKeys,
				linkedAddress: supplementalPublicKeys.linked === Constants.Message.UNAVAILABLE ? supplementalPublicKeys.linked : helper.publicKeyToAddress(supplementalPublicKeys.linked),
				nodeAddress: supplementalPublicKeys.node === Constants.Message.UNAVAILABLE ? supplementalPublicKeys.node : helper.publicKeyToAddress(supplementalPublicKeys.node),
				vrfAddress: supplementalPublicKeys.vrf === Constants.Message.UNAVAILABLE ? supplementalPublicKeys.vrf : helper.publicKeyToAddress(supplementalPublicKeys.vrf)
			},
			votingList:
				supplementalPublicKeys.voting.length > 0 ? supplementalPublicKeys.voting.map(voting => ({
					...voting,
					epochInfo: {
						epochStart: voting.startEpoch,
						epochEnd: voting.endEpoch,
						epochStatus: getVotingEpochStatus(voting.startEpoch, voting.endEpoch)
					},
					address: helper.publicKeyToAddress(voting.publicKey),
					publicKey: voting.publicKey

				})).sort((a, b) => {
					const orderStatus = {
						[Constants.EpochStatus.CURRENT]: 1,
						[Constants.EpochStatus.FUTURE]: 2,
						[Constants.EpochStatus.EXPIRED]: 3
					};

					return orderStatus[a.epochInfo.epochStatus] - orderStatus[b.epochInfo.epochStatus];
				}) : [],
			accountAliasNames: this.extractAccountNamespace(accountInfo, accountNames)
		};
	}

	/**
	 * Gets custom array of confirmed transactions dataset into Vue Component
	 * @param pageInfo - object for page info such as pageNumber, pageSize
	 * @param filterVaule - object for search criteria
	 * @param address - Account address
	 * @returns Custom AggregateTransaction[]
	 */
	static getAccountTransactionList = async (pageInfo, filterVaule, address) => {
		const { pageNumber, pageSize } = pageInfo;
		const searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc,
			type: [],
			group: TransactionGroup.Confirmed,
			address: Address.createFromRawAddress(address),
			...filterVaule
		};

		const searchTransactions = await TransactionService.searchTransactions(searchCriteria);

		const accountTransactions = {
			...searchTransactions,
			data: searchTransactions.data.map(transaction => TransactionService.formatTransaction(transaction))
		};

		await Promise.all(accountTransactions.data.map(async transaction => {
			if (transaction?.recipientAddress) {
				const { recipientAddress, transactionBody, transactionInfo } = transaction;

				return (transactionBody.recipient = await helper.resolvedAddress(recipientAddress, transactionInfo.height));
			}
		}));

		if (searchCriteria.group === TransactionGroup.Partial || searchCriteria.group === TransactionGroup.Unconfirmed) {
			return {
			  	...accountTransactions,
				data: accountTransactions.data.map(accountTransaction => ({
					...accountTransaction,
					transactionHash: accountTransaction.transactionInfo.hash,
					transactionType: accountTransaction.type,
					recipient: accountTransaction.transactionBody?.recipient,
					extendGraphicValue: TransactionService.extendGraphicValue(accountTransaction)
				}))
			};
		}

		const blockHeight = [...new Set(accountTransactions.data.map(data => data.transactionInfo.height))];

		const blockInfos = await Promise.all(
			blockHeight.map(height => BlockService.getBlockInfo(height))
		);

		return {
			...accountTransactions,
			data: accountTransactions.data.map(({ deadline, ...accountTransaction }) => ({
				...accountTransaction,
				timestamp: blockInfos.find(block => block.height === accountTransaction.transactionInfo.height).timestamp,
				blockHeight: accountTransaction.transactionInfo.height,
				transactionHash: accountTransaction.transactionInfo.hash,
				transactionType: accountTransaction.type === TransactionType.TRANSFER
					? (accountTransaction.signer === address
						? 'outgoing_' + accountTransaction.transactionBody.transactionType
						: 'incoming_' + accountTransaction.transactionBody.transactionType
					)
					: accountTransaction.transactionBody.transactionType,
				extendGraphicValue: TransactionService.extendGraphicValue(accountTransaction),
				recipient: accountTransaction.signer === address
					? accountTransaction.transactionBody?.recipient
					: ''
			}))
		};
	}

	/**
	 * Gets custom array of confirmed transactions dataset into Vue Component
	 * @param pageInfo - object for page info such as pageNumber, pageSize
	 * @param filterVaule - object for search criteria
	 * @param address - Account address
	 * @returns Custom AggregateTransaction[]
	 */
	static getAccountNamespaceList = async (pageInfo, filterVaule, address) => {
		const { pageNumber, pageSize } = pageInfo;
		const searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc,
			ownerAddress: Address.createFromRawAddress(address),
			...filterVaule
		};

		const accountNamespaces = await NamespaceService.searchNamespaces(searchCriteria);

		const { height: currentHeight } = await ChainService.getChainInfo();

		return {
			...accountNamespaces,
			data: accountNamespaces.data.map(namespaces => {
				const { expiredInSecond } = helper.calculateNamespaceExpiration(currentHeight, namespaces.endHeight);

				return {
					...namespaces,
					status: namespaces.active,
					expirationDuration: helper.convertTimeFromNowInSec(expiredInSecond) || Constants.Message.UNLIMITED
				};
			})
		};
	}

	/**
	 * Gets account harvested block receipt list dataset into Vue Component
	 * @param pageInfo - object for page info such as pageNumber, pageSize
	 * @param address - Account address
	 * @returns formatted harvested blocks data list.
	 */
	static getAccountHarvestedReceiptList = async (pageInfo, address) => {
		const { pageNumber, pageSize } = pageInfo;

		const searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc,
			orderBy: BlockOrderBy.Height,
			targetAddress: Address.createFromRawAddress(address),
			receiptTypes: [ReceiptType.Harvest_Fee]
		};

		const harvestedBlockReceipt = await ReceiptService.searchReceipts(searchCriteria);

		const formattedReceipt = await ReceiptService.createReceiptTransactionStatement(harvestedBlockReceipt.data.balanceChangeStatement);

		return {
			...harvestedBlockReceipt,
			data: formattedReceipt.filter(receipt =>
				receipt.targetAddress === address &&
				receipt.type === ReceiptType.Harvest_Fee)
		};
	}

	/**
	 * Gets account receipt list dataset into Vue Component
	 * @param pageInfo - object for page info such as pageNumber, pageSize
	 * @param filterVaule - object for search criteria
	 * @param address - Account address
	 * @returns formatted receipt data list.
	 */
	static getAccountReceiptList = async (pageInfo, filterVaule, address) => {
		const { pageNumber, pageSize } = pageInfo;

		const { BalanceTransferReceipt, BalanceChangeReceipt } = Constants.ReceiptTransactionStatamentType;

		let searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc,
			orderBy: BlockOrderBy.Height,
			...filterVaule
		};

		if (filterVaule.receiptTransactionStatementType === BalanceTransferReceipt)
			Object.assign(searchCriteria, { senderAddress: Address.createFromRawAddress(address) });

		if (filterVaule.receiptTransactionStatementType === BalanceChangeReceipt)
			Object.assign(searchCriteria, { targetAddress: Address.createFromRawAddress(address) });

		const receipt = await ReceiptService.searchReceipts(searchCriteria);

		let formattedReceipt = [];

		if (filterVaule.receiptTransactionStatementType === BalanceTransferReceipt) {
			formattedReceipt = await ReceiptService.createReceiptTransactionStatement(receipt.data.balanceTransferStatement);
			formattedReceipt = formattedReceipt.filter(receipt =>
				receipt.senderAddress === address);
		}

		if (filterVaule.receiptTransactionStatementType === BalanceChangeReceipt) {
			formattedReceipt = await ReceiptService.createReceiptTransactionStatement(receipt.data.balanceChangeStatement);
			formattedReceipt = formattedReceipt.filter(receipt =>
				receipt.targetAddress === address &&
				receipt.type !== ReceiptType.Harvest_Fee);
		}

		return {
			...receipt,
			data: formattedReceipt
		};
	}

	/**
	 * Gets Account Metadata list dataset into Vue component
	 * @param pageInfo - object for page info such as pageNumber, pageSize
	 * @param filterVaule - object for search criteria
	 * @param address - Account address
	 * @returns formatted account metadata list
	 */
	static getAccountMetadataList = async (pageInfo, filterVaule, address) => {
		const { pageNumber, pageSize } = pageInfo;
		const searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc,
			targetAddress: Address.createFromRawAddress(address),
			...filterVaule
		};
		const accountMetadatas = await MetadataService.searchMetadatas(searchCriteria);

		return accountMetadatas;
	}

	/**
	 * Gets Account Hash Lock list dataset into Vue component
	 * @param pageInfo - object for page info such as pageNumber, pageSize
	 * @param address - Account address
	 * @returns formatted account hash lock list
	 */
	static getAccountHashLockList = async (pageInfo, address) => {
		const { pageNumber, pageSize } = pageInfo;
		const searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc,
			address: Address.createFromRawAddress(address)
		};
		const accountHashLocks = await LockService.searchHashLocks(searchCriteria);

		const mosaics = accountHashLocks.data.map(
			hashlock => new Mosaic(hashlock.mosaicId, hashlock.amount)
		);

		const mosaicsFieldObject = await helper.mosaicsFieldObjectBuilder(mosaics);

		let hashLocks = [];

		for (const hashLock of accountHashLocks.data) {
			hashLocks.push({
				...hashLock,
				transactionHash: hashLock.hash,
				mosaics: [mosaicsFieldObject.find(mosaicFieldObject => mosaicFieldObject.mosaicId === hashLock.mosaicId.toHex())]
			});
		}

		return {
			...accountHashLocks,
			data: hashLocks
		};
	}

	/**
	 * Gets Account Secret Lock list dataset into Vue component
	 * @param pageInfo - object for page info such as pageNumber, pageSize
	 * @param address - Account address
	 * @returns formatted account secret lock list
	 */
	static getAccountSecretLockList = async (pageInfo, address) => {
		const { pageNumber, pageSize } = pageInfo;

		const searchCriteria = {
			pageNumber,
			pageSize,
			order: Order.Desc,
			address: Address.createFromRawAddress(address)
		};

		const accountSecretLocks = await LockService.searchSecretLocks(searchCriteria);

		const mosaics = accountSecretLocks.data.map(
			secretlock => new Mosaic(secretlock.mosaicId, secretlock.amount)
		);

		const mosaicsFieldObject = await helper.mosaicsFieldObjectBuilder(mosaics);

		let secretLocks = [];

		for (const secretLock of accountSecretLocks.data) {
			secretLocks.push({
				...secretLock,
				mosaics: [mosaicsFieldObject.find(mosaicFieldObject => mosaicFieldObject.mosaicId === secretLock.mosaicId.toHex())]
			});
		}

		return {
			...accountSecretLocks,
			data: secretLocks
		};
	}

	/**
	 * Format AccountInfo to readable accountInfo objecy
	 * @param accountInfo - AccountInfo DTO
	 * @returns Readable AccountInfo DTO object
	 */
	static formatAccountInfo = (accountInfo) => ({
		...accountInfo,
		address: accountInfo.address.address,
		addressHeight: accountInfo.addressHeight.compact(),
		publicKey: accountInfo.publicKeyHeight.compact() > 0 ? accountInfo.publicKey : Constants.Message.UNKNOWN,
		publicKeyHeight: accountInfo.publicKeyHeight.compact(),
		accountType: Constants.AccountType[accountInfo.accountType],
		supplementalPublicKeys: this.formatSupplementalPublicKeys(accountInfo.supplementalPublicKeys),
		importance: helper.ImportanceScoreToPercent(accountInfo.importance.compact()),
		importanceHeight: accountInfo.importanceHeight.compact()
	})

	/**
	 * Format SupplementalPublicKeys to readable SupplementalPublicKeys objecy
	 * @param supplementalPublicKeys - supplementalPublicKeys DTO
	 * @returns Readable supplementalPublicKeys DTO object
	 */
	static formatSupplementalPublicKeys = (supplementalPublicKeys) => ({
		...supplementalPublicKeys,
		linked: supplementalPublicKeys.linked?.publicKey || Constants.Message.UNAVAILABLE,
		node: supplementalPublicKeys.node?.publicKey || Constants.Message.UNAVAILABLE,
		vrf: supplementalPublicKeys.vrf?.publicKey || Constants.Message.UNAVAILABLE,
		voting: supplementalPublicKeys.voting || []
	})

	/**
	 * Extract Name for Account
	 * @param accountInfo - accountInfo DTO
	 * @param accountNames - accountNames[]
	 * @returns accountName
	 */
	static extractAccountNamespace = (accountInfo, accountNames) => {
		let accountName = accountNames.find((name) => name.address === accountInfo.address);

		const aliasNames = accountName.names.map(names => names.name);

		const names = aliasNames.length > 0 ? aliasNames : [Constants.Message.UNAVAILABLE];

		return names;
	}

	/**
	 * Get customize MosaicAmountView dataset for Vue component.
	 * @param address - Account address
	 * @returns customize MosaicAmountView[]
	 */
	static getAccountMosaicList = async address => {
		const [mosaics, chainInfo] = await Promise.all([
			MosaicService.getMosaicAmountViewList(address),
			ChainService.getChainInfo()
		]);

		let nonExpiredMosaics = [];

		for (const mosaic of mosaics) {
			if (mosaic.duration === 0)
				nonExpiredMosaics.push(mosaic);

			if (chainInfo.height < (mosaic.startHeight + mosaic.duration))
				nonExpiredMosaics.push(mosaic);
		}

		return helper.sortMosaics(nonExpiredMosaics);
	}

	static checkNis1Account = async address => {
		return nem.model.address.isValid(address);
	}
}

export default AccountService;
