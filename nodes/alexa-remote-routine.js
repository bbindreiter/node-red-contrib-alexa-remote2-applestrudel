const tools = require('../lib/common.js');

module.exports = function (RED) {
	function AlexaRemoteRoutine(input) {
		RED.nodes.createNode(this, input);
		tools.assign(this, ['routineNode'], input);
		tools.assignNode(RED, this, ['account'], input);
		if (!tools.nodeSetup(this, input, true)) return;

		const log = tools.nodeGetLogCb(this);
		const warn = tools.nodeGetWarnCb(this);
		const error = tools.nodeGetErrorCb(this);

		this.on('input', function (msg) {
			const send = tools.nodeGetSendCb(this, msg);
			if (this.account.state.code !== 'READY') return error('Account not initialised!');
			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const raw = this.routineNode;
			const evaluated = tools.nodeEvaluateProperties(RED, this, msg, this.routineNode);
			const customerId = alexa.ownerCustomerId;
			const locale = this.account.locale || 'en-US';
            const onKeyword = this.account.onKeywordInLanguage || '';
			const deviceToVolume = new Map();

			function nativizePromptType(prompt) {
				switch (prompt) {
					case 'goodMorning':      return 'Alexa.GoodMorning.Play';
					case 'goodNight':        return 'Alexa.GoodNight.Play';
					case 'weather':          return 'Alexa.Weather.Play';
					case 'traffic':          return 'Alexa.Traffic.Play';
					case 'flashBriefing':    return 'Alexa.FlashBriefing.Play';
					case 'singSong':         return 'Alexa.SingASong.Play';
					case 'joke':             return 'Alexa.Joke.Play';
					case 'tellStory':        return 'Alexa.TellStory.Play';
					case 'calendarToday':    return 'Alexa.Calendar.PlayToday';
					case 'calendarTomorrow': return 'Alexa.Calendar.PlayTomorrow';
					case 'calendarNext':     return 'Alexa.Calendar.PlayNext';
					case 'funFact':          return 'Alexa.FunFact.Play';
					case 'cleanUp':          return 'Alexa.CleanUp.Play';
					case 'imHome':           return 'Alexa.ImHome.Play';
					default: throw new Error(`invalid prompt: "${prompt}"`);
				}
			}
			const find = (id) => {
				const device = alexa.find(id);
				if (!device) throw new Error(`could not find device: "${id}"`);
				return device;
			};

			const findAll = (ids, depth = 1) => {
				let devices = [];
				for (const id of ids) {
					if (id === 'ALEXA_ALL_DSN') return [{
						serialNumber: 'ALEXA_ALL_DSN',
						deviceType: 'ALEXA_ALL_DEVICE_TYPE',
						clusterMembers: [],
						deviceOwnerCustomerId: customerId,
					}];
					const device = find(id);

					if (device.clusterMembers.length !== 0 && depth !== 0) {
						// we are dealing with a group so we seperate it into members because
						// groups don't work
						const members = findAll(device.clusterMembers, depth - 1);
						devices = devices.concat(members);
					}
					else {
						devices.push(device);
					}
				}
				return devices;
			};

			async function nativizeNode(node) {
				const invalid = (expected) => new Error(`invalid sequence node: "${JSON.stringify(node)}" expected layout: "${JSON.stringify(expected)}"`);
				const check = (template) => { if (!tools.matches(node, template)) throw invalid(template); };
				const checkPayload = (template) => { if (!tools.matches(node.payload, template)) throw invalid(template); };
				check({ type: '', payload: {} });

				switch (node.type) {
					case 'speak': {
						if (!Array.isArray(node.payload.devices)) {
							const single = node.payload.devices || node.payload.device;
							node.payload.devices = single ? [single] : [];
						}
						checkPayload({ type: '', text: '' });
						const devices = findAll(node.payload.devices);

						switch (node.payload.type) {
							case 'regular':
								if (devices.length === 0) return undefined;
								if (devices.length === 1) return {
									'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
									type: 'Alexa.Speak',
									operationPayload: {
										deviceType: devices[0].deviceType,
										deviceSerialNumber: devices[0].serialNumber,
										locale: locale,
										customerId: customerId,
										textToSpeak: node.payload.text
									}
								};

								return await nativizeNode({
									type: 'node',
									payload: {
										type: 'parallel',
										children: devices.map(device => ({
											type: 'speak',
											payload: {
												type: 'regular',
												text: node.payload.text,
												device: device,
											}
										}))
									}
								});
							case 'ssml':
							case 'announcement': return {
								'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
								type: 'AlexaAnnouncement',
								operationPayload: {
									expireAfter: 'PT5S',
									customerId: customerId,
									content: [{
										locale: locale,
										display: {
											title: 'Node-RED',
											body: node.payload.text.replace(/<[^>]+>/g, '')
										},
										speak: {
											type: node.payload.type === 'ssml' ? 'ssml' : 'text',
											value: node.payload.text
										}
									}],
									target: {
										customerId: customerId,
										devices: devices.length === 0 ? undefined : devices.map(device => ({
											deviceSerialNumber: device.serialNumber,
											deviceTypeId: device.deviceType,
										}))
									}
								}
							};
							default: throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);
						}
					}
					case 'speakAtVolume': {
						if (!Array.isArray(node.payload.devices)) {
							const single = node.payload.devices || node.payload.device;
							node.payload.devices = single ? [single] : [];
						}
						checkPayload({ type: '', text: '', /*mode: '',*/ volume: undefined });
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						let devicesWithVolume = [];

						for (const device of devices) {
							if (deviceToVolume.has(device)) {
								devicesWithVolume.push(device);
								continue;
							}

							const media = await alexa.getMediaPromise(device);

							if (tools.matches(media, { volume: 50 })) {
								deviceToVolume.set(device, media.volume);
								devicesWithVolume.push(device);
							}
							else {
								//warn(`could not fetch volume for device "${device.accountName || device.serialNumber}", falling back to regular speak`);
							}
						}

						if(devicesWithVolume.length == 0) {
							return await nativizeNode({
								type: 'speak',
								payload: {
									type: node.payload.type,
									text: node.payload.text,
									devices: devices,
								}
							});
						}

						if(node.payload.mode === 'add') {
							return await nativizeNode({
								type: 'node',
								payload: {
									type: 'serial',
									children: [
										{
											type: 'node',
											payload: {
												type: 'parallel',
												children: devicesWithVolume.map(device => ({
													type: 'volume',
													payload: {
														value: tools.clamp(deviceToVolume.get(device) + node.payload.volume, 0, 100),
														device: device,
													}
												}))
											}
										},
										{
											type: 'speak',
											payload: {
												type: node.payload.type,
												text: node.payload.text,
												devices: devices,
											}
										},
										{
											type: 'node',
											payload: {
												type: 'parallel',
												children: devicesWithVolume.map(device => ({
													type: 'volume',
													payload: {
														value: deviceToVolume.get(device),
														device: device,
													}
												}))
											}
										}
									]
								}
							});
						}
						else {
							return await nativizeNode({
								type: 'node',
								payload: {
									type: 'serial',
									children: [
										{
											type: 'volume',
											payload: {
												value: node.payload.volume,
												devices: devicesWithVolume,
											}
										},
										{
											type: 'speak',
											payload: {
												type: node.payload.type,
												text: node.payload.text,
												devices: devices,
											}
										},
										{
											type: 'node',
											payload: {
												type: 'parallel',
												children: devicesWithVolume.map(device => ({
													type: 'volume',
													payload: {
														value: deviceToVolume.get(device),
														device: device,
													}
												}))
											}
										}
									]
								}
							});
						}
					}
					case 'textCommand': {
						if (!Array.isArray(node.payload.devices)) {
							const single = node.payload.devices || node.payload.device;
							node.payload.devices = single ? [single] : [];
						}
						checkPayload({ text: '' });
						const devices = findAll(node.payload.devices);

						if (devices.length === 0) return undefined;
						if (devices.length === 1) return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.TextCommand',
							skillId: 'amzn1.ask.1p.tellalexa',
							operationPayload: {
								deviceType: devices[0].deviceType,
								deviceSerialNumber: devices[0].serialNumber,
								locale: locale,
								customerId: customerId,
								text: node.payload.text
							}
						};

						return await nativizeNode({
							type: 'node',
							payload: {
								type: 'parallel',
								children: devices.map(device => ({
									type: 'textCommand',
									payload: {
										text: node.payload.text,
										device: device,
									}
								}))
							}
						});
					}
					case 'stop': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						checkPayload({ devices: [] });
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.DeviceControls.Stop',
							skillId: 'amzn1.ask.1p.alexadevicecontrols',
							operationPayload: {
								customerId: customerId,
								devices: devices.map(device => ({
									deviceSerialNumber: device.serialNumber,
									deviceType: device.deviceType,
								})),
								isAssociatedDevice: false
							},
							name: null
						};
					}
					case 'prompt': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						checkPayload({ type: '', devices: [] });
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						if (devices.length === 1) return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: nativizePromptType(node.payload.type),
							operationPayload: {
								deviceType: devices[0].deviceType,
								deviceSerialNumber: devices[0].serialNumber,
								locale: locale,
								customerId: customerId,
							}
						};

						return await nativizeNode({
							type: 'node',
							payload: {
								type: 'parallel',
								children: devices.map(device => ({
									type: 'prompt',
									payload: {
										type: node.payload.type,
										device: device,
									}
								}))
							}
						});
					}
					case 'phrase': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						checkPayload({ category: '', devices: [] });
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						if (devices.length === 1) return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.CannedTts.Speak',
							skillId: 'amzn1.ask.1p.saysomething',
							operationPayload: {
								customerId: customerId,
								deviceType: devices[0].deviceType,
								deviceSerialNumber: devices[0].serialNumber,
								cannedTtsStringId: `alexa.cannedtts.speak.curatedtts-category-${node.payload.category}/alexa.cannedtts.speak.curatedtts-random`,
								locale: locale,
							},
							name: null
						};

						return await nativizeNode({
							type: 'node',
							payload: {
								type: 'parallel',
								children: devices.map(device => ({
									type: 'phrase',
									payload: {
										category: node.payload.category,
										device: device,
									}
								}))
							}
						});
					}
					case 'sound': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						checkPayload({ sound: '', devices: [] });
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						if (devices.length === 1)	return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.Sound',
							skillId: 'amzn1.ask.1p.sound',
							operationPayload: {
								customerId: customerId,
								deviceType: devices[0].deviceType,
								deviceSerialNumber: devices[0].serialNumber,
								soundStringId: node.payload.sound,
								locale: locale,
							},
							tag: null,
							name: null,
						}

						return await nativizeNode({
							type: 'node',
							payload: {
								type: 'parallel',
								children: devices.map(device => ({
									type: 'sound',
									payload: {
										sound: node.payload.sound,
										device: device,
									}
								}))
							}
						});
					}
					case 'volume': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						checkPayload({ value: undefined, /*mode: '',*/ devices: [] });
						const volume = Number(node.payload.value);
						if (Number.isNaN(volume)) throw invalid();
						const devices = findAll(node.payload.devices);
						if (devices.length === 0) return undefined;

						if(node.payload.mode === 'add')
						{
							let devicesWithVolume = [];

							for (const device of devices) {
								if (deviceToVolume.has(device)) {
									devicesWithVolume.push(device);
									continue;
								}

								const media = await alexa.getMediaPromise(device);

								if (tools.matches(media, { volume: 50 })) {
									deviceToVolume.set(device, media.volume);
									devicesWithVolume.push(device);
								}
								else {
									warn(`could not fetch volume for device "${device.accountName || device.serialNumber}", ignoring this device...`);
								}
							}

							return await nativizeNode({
								type: 'node',
								payload: {
									type: 'parallel',
									children: devicesWithVolume.map(device => ({
										type: 'volume',
										payload: {
											value: tools.clamp(deviceToVolume.get(device) + node.payload.value, 0, 100),
											device: device,
										}
									}))
								}
							});
						}
						else {
							if (devices.length === 1) return {
								'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
								type: 'Alexa.DeviceControls.Volume',
								operationPayload: {
									deviceType: devices[0].deviceType,
									deviceSerialNumber: devices[0].serialNumber,
									locale: locale,
									customerId: customerId,
									value: volume,
								}
							};

							return await nativizeNode({
								type: 'node',
								payload: {
									type: 'parallel',
									children: devices.map(device => ({
										type: 'volume',
										payload: {
											value: volume,
											device: device,
										}
									}))
								}
							});
						}
					}
					case 'music': {
						checkPayload({ device: undefined, provider: '', search: '' });
						const device = find(node.payload.device);

						let searchPhrase = node.payload.search;
						let deviceType = device.deviceType;
						let deviceSerialNumber = device.serialNumber;

						if (device.deviceFamily == 'WHA') {
							const firstClusterDevice = find(device.clusterMembers[0]);

							searchPhrase = searchPhrase + ' ' + onKeyword + ' ' + device.accountName;
							deviceType = firstClusterDevice.deviceType;
							deviceSerialNumber = firstClusterDevice.serialNumber;
						}


						const operationPayload = {
							deviceType: deviceType,
							deviceSerialNumber: deviceSerialNumber,
							locale: locale,
							customerId: customerId,
							musicProviderId: node.payload.provider,
							searchPhrase: searchPhrase,
						};

						if (typeof node.payload.duration === 'number' && node.payload.duration !== 0) {
							operationPayload.waitTimeInSeconds = node.payload.duration;
						}

						const native = {
							type: 'Alexa.Music.PlaySearchPhrase',
							operationPayload: JSON.stringify(operationPayload),
						};

						await alexa.validateRoutineNodeExt(native);

						native['@type'] = 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode';
						return native;
					}
					case 'wait': {
						const time = Number(node.payload.time);
						if (Number.isNaN(time)) throw invalid();

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.System.Wait',
							skillId: null,
							operationPayload: {
								waitTimeInSeconds: node.payload.time
							},
							name: null,
						};
					}
					case 'smarthome': {
						checkPayload({ entity: '', action: '' });

						const entity = alexa.findSmarthomeEntityExt(node.payload.entity);
						if (!entity) throw new Error(`could not find smarthome entity: "${node.payload.device}"`);

						const parameters = { type: node.payload.action };
						switch (node.payload.action) {
							case 'setColor': {
								parameters.colorName = alexa.findSmarthomeColorNameExt(node.payload.value);
								break;
							}
							case 'setColorTemperature': {
								parameters.colorTemperatureName = alexa.findSmarthomeColorTemperatureNameExt(node.payload.value);
								break;
							}
							case 'setBrightness': {
								parameters.brightness = Number(node.payload.value);
								break;
							}
							case 'setPercentage': {
								parameters.percentage = Number(node.payload.value);
								break;
							}
							case 'setLockState':
							case 'lockAction': {
								parameters.targetLockState = {
									value: String(node.payload.value).trim().toUpperCase()
								};
								break;
							}
							case 'setTargetTemperature': {
								parameters.targetTemperature = {
									scale: String(node.payload.scale).trim().toUpperCase() || 'CELSIUS',
									value: Number(node.payload.value)
								};
								break;
							}
						}

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.SmartHome.Batch',
							skillId: 'amzn1.ask.1p.smarthome',
							operationPayload: {
								target: entity.entityId,
								customerId: customerId,
								operations: [
									parameters
								],
								name: null,
							}
						};
					}
					case 'routine': {
						checkPayload({ routine: '', device: undefined });

						const device = find(node.payload.device);
						const routine = alexa.findRoutineExt(node.payload.routine);
						if (!routine) throw new Error(`could not find routine: "${node.payload.routine}"`);

						const routineNode = tools.clone(routine.sequence.startNode);

						tools.mapObjectValues(routineNode, (key, val) => {
							if (key === 'deviceType' && val === 'ALEXA_CURRENT_DEVICE_TYPE') return device.deviceType;
							if (key === 'deviceTypeId' && val === 'ALEXA_CURRENT_DEVICE_TYPE') return device.deviceType;
							if (key === 'deviceSerialNumber' && val === 'ALEXA_CURRENT_DSN') return device.serialNumber;
							if (key === 'locale' && val === 'ALEXA_CURRENT_LOCALE') return locale;
							return val;
						});

						return routineNode;
					}
					case 'skill': {
						checkPayload({ skill: '', device: undefined });
						const device = find(node.payload.device);

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.Operation.SkillConnections.Launch',
							skillId: node.payload.skill,
							operationPayload: {
								locale: locale,
								customerId: customerId,
								targetDevice: {
									deviceType: device.deviceType,
									deviceSerialNumber: device.serialNumber
								},
								connectionRequest: {
									uri: `connection://AMAZON.Launch/${node.payload.skill}`,
									input: {}
								}
							},
							name: null
						};
					}
					case 'pushNotification': {
						if (!tools.matches(node.payload, { text: '' })) throw invalid();

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.Notifications.SendMobilePush',
							skillId: 'amzn1.ask.1p.alexanotifications',
							operationPayload: {
								customerId: customerId,
								notificationMessage: node.payload.text,
								alexaUrl: '#v2/behaviors',
								title: node.payload.title || 'Node-RED'
							},
							name: null
						};
					}
					case 'node': {
						checkPayload({ type: '', children: [] });

						const suffix =
							node.payload.type === 'serial' ? 'SerialNode' :
							node.payload.type === 'parallel' ? 'ParallelNode' :
							undefined;

						if (!suffix) throw invalid();

						const nativeChildren = [];
						for (const child of node.payload.children) {
							const native = await nativizeNode(child);
							if(native) nativeChildren.push(native);
						}

						return {
							'@type': `com.amazon.alexa.behaviors.model.${suffix}`,
							nodesToExecute: nativeChildren,
							name: null,
						};
					}
					case 'custom': {
						checkPayload({});
						return await nativizeNode(node.payload);
					}
					default: throw invalid();
				}
			}

			nativizeNode(evaluated).then(native => {
				if(!native) { warn('no devices'); return; }

				log(`request: "${JSON.stringify(native)}"`);

				alexa.sendSequenceNodeExt(native).then(response => {
					if(!tools.matches(response, { message: '' })) return response;
					throw new Error(`Response: ${response.message}`);
				}).then(send).catch(e => {
					error(e);
					log(`raw: "${JSON.stringify(raw)}"`);
					log(`evaluated: "${JSON.stringify(evaluated)}"`);
					log(`native: "${JSON.stringify(native)}"`);
				});
			}).catch(e => {
				error(e);
				log(`raw: "${JSON.stringify(raw)}"`);
				log(`evaluated: "${JSON.stringify(evaluated)}"`);
			});
		});
	}
	RED.nodes.registerType("alexa-remote-routine", AlexaRemoteRoutine);
};