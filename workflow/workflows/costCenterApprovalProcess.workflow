{
	"contents": {
		"a34154b3-faea-4a10-908a-252a9ac14744": {
			"classDefinition": "com.sap.bpm.wfs.Model",
			"id": "com.deloitte.mdg.costcenter.workflow.costcenterapprovalprocess",
			"subject": "costCenterApprovalProcess",
			"name": "costCenterApprovalProcess",
			"documentation": "Triggers and manages the approval flow for Cost Center",
			"lastIds": "62d7f4ed-4063-4c44-af8b-39050bd44926",
			"events": {
				"11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3": {
					"name": "StartEvent1"
				},
				"2798f4e7-bc42-4fad-a248-159095a2f40a": {
					"name": "EndEvent1"
				}
			},
			"activities": {
				"00a02bd9-f39d-419b-a5cf-7092a56145f9": {
					"name": "Script Task - 1"
				},
				"ea927550-f829-41ef-8857-52ce52b8afaf": {
					"name": "Cost Center Approver"
				},
				"2c62dce0-1fe6-43ac-95e6-9d7cd2f3f85f": {
					"name": "Script Task - 2"
				}
			},
			"sequenceFlows": {
				"c6b99f32-5fe6-4ab6-b60a-80fba1b9ae0f": {
					"name": "SequenceFlow1"
				},
				"f82b7294-40b6-4adf-84f6-69d888f1ff73": {
					"name": "SequenceFlow2"
				},
				"458cfe12-f543-4710-bf1c-4e25011a4699": {
					"name": "SequenceFlow3"
				},
				"4f39c179-0e81-407f-8812-9a15d8fe674f": {
					"name": "SequenceFlow4"
				}
			},
			"diagrams": {
				"42fa7a2d-c526-4a02-b3ba-49b5168ba644": {}
			}
		},
		"11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3": {
			"classDefinition": "com.sap.bpm.wfs.StartEvent",
			"id": "startevent1",
			"name": "StartEvent1"
		},
		"2798f4e7-bc42-4fad-a248-159095a2f40a": {
			"classDefinition": "com.sap.bpm.wfs.EndEvent",
			"id": "endevent1",
			"name": "EndEvent1"
		},
		"00a02bd9-f39d-419b-a5cf-7092a56145f9": {
			"classDefinition": "com.sap.bpm.wfs.ScriptTask",
			"reference": "/scripts/costCenterApprovalProcess/InitalScript.js",
			"id": "scripttask1",
			"name": "Script Task - 1"
		},
		"ea927550-f829-41ef-8857-52ce52b8afaf": {
			"classDefinition": "com.sap.bpm.wfs.UserTask",
			"subject": "${context.ReqId} - Cost Center Approval Required",
			"priority": "MEDIUM",
			"isHiddenInLogForParticipant": false,
			"supportsForward": false,
			"userInterface": "sapui5://e71d911d-d437-4748-bee8-95a799765be0.DG-CostCenter.comdeloittemdgcostcenterapproverapprover/com.deloitte.mdg.costcenter.approver.approver",
			"recipientGroups": "DataGuardian_Tiles",
			"id": "usertask1",
			"name": "Cost Center Approver"
		},
		"2c62dce0-1fe6-43ac-95e6-9d7cd2f3f85f": {
			"classDefinition": "com.sap.bpm.wfs.ScriptTask",
			"reference": "/scripts/costCenterApprovalProcess/FinalScript.js",
			"id": "scripttask2",
			"name": "Script Task - 2"
		},
		"c6b99f32-5fe6-4ab6-b60a-80fba1b9ae0f": {
			"classDefinition": "com.sap.bpm.wfs.SequenceFlow",
			"id": "sequenceflow1",
			"name": "SequenceFlow1",
			"sourceRef": "11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3",
			"targetRef": "00a02bd9-f39d-419b-a5cf-7092a56145f9"
		},
		"f82b7294-40b6-4adf-84f6-69d888f1ff73": {
			"classDefinition": "com.sap.bpm.wfs.SequenceFlow",
			"id": "sequenceflow2",
			"name": "SequenceFlow2",
			"sourceRef": "00a02bd9-f39d-419b-a5cf-7092a56145f9",
			"targetRef": "ea927550-f829-41ef-8857-52ce52b8afaf"
		},
		"458cfe12-f543-4710-bf1c-4e25011a4699": {
			"classDefinition": "com.sap.bpm.wfs.SequenceFlow",
			"id": "sequenceflow3",
			"name": "SequenceFlow3",
			"sourceRef": "ea927550-f829-41ef-8857-52ce52b8afaf",
			"targetRef": "2c62dce0-1fe6-43ac-95e6-9d7cd2f3f85f"
		},
		"4f39c179-0e81-407f-8812-9a15d8fe674f": {
			"classDefinition": "com.sap.bpm.wfs.SequenceFlow",
			"id": "sequenceflow4",
			"name": "SequenceFlow4",
			"sourceRef": "2c62dce0-1fe6-43ac-95e6-9d7cd2f3f85f",
			"targetRef": "2798f4e7-bc42-4fad-a248-159095a2f40a"
		},
		"42fa7a2d-c526-4a02-b3ba-49b5168ba644": {
			"classDefinition": "com.sap.bpm.wfs.ui.Diagram",
			"symbols": {
				"df898b52-91e1-4778-baad-2ad9a261d30e": {},
				"53e54950-7757-4161-82c9-afa7e86cff2c": {},
				"6bb141da-d485-4317-93b8-e17711df4c32": {},
				"267217b6-08a9-4c99-9f58-0f3945889f2c": {},
				"f4b28e28-9599-4bea-a336-53d27999cdd5": {},
				"b882bf64-a056-4774-b545-eb3a5df60381": {},
				"965bc667-3db6-473a-9a41-49c66a377078": {},
				"59c820a9-2322-4654-8e90-dc008522bd7f": {},
				"eb51c9da-fdae-498b-b4bf-124364032ed4": {}
			}
		},
		"df898b52-91e1-4778-baad-2ad9a261d30e": {
			"classDefinition": "com.sap.bpm.wfs.ui.StartEventSymbol",
			"x": 100,
			"y": 100,
			"width": 32,
			"height": 32,
			"object": "11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3"
		},
		"53e54950-7757-4161-82c9-afa7e86cff2c": {
			"classDefinition": "com.sap.bpm.wfs.ui.EndEventSymbol",
			"x": 616,
			"y": 98,
			"width": 35,
			"height": 35,
			"object": "2798f4e7-bc42-4fad-a248-159095a2f40a"
		},
		"6bb141da-d485-4317-93b8-e17711df4c32": {
			"classDefinition": "com.sap.bpm.wfs.ui.SequenceFlowSymbol",
			"points": "116,117 198,117",
			"sourceSymbol": "df898b52-91e1-4778-baad-2ad9a261d30e",
			"targetSymbol": "267217b6-08a9-4c99-9f58-0f3945889f2c",
			"object": "c6b99f32-5fe6-4ab6-b60a-80fba1b9ae0f"
		},
		"267217b6-08a9-4c99-9f58-0f3945889f2c": {
			"classDefinition": "com.sap.bpm.wfs.ui.ScriptTaskSymbol",
			"x": 148,
			"y": 88,
			"width": 100,
			"height": 60,
			"object": "00a02bd9-f39d-419b-a5cf-7092a56145f9"
		},
		"f4b28e28-9599-4bea-a336-53d27999cdd5": {
			"classDefinition": "com.sap.bpm.wfs.ui.SequenceFlowSymbol",
			"points": "198,118 357,118",
			"sourceSymbol": "267217b6-08a9-4c99-9f58-0f3945889f2c",
			"targetSymbol": "b882bf64-a056-4774-b545-eb3a5df60381",
			"object": "f82b7294-40b6-4adf-84f6-69d888f1ff73"
		},
		"b882bf64-a056-4774-b545-eb3a5df60381": {
			"classDefinition": "com.sap.bpm.wfs.ui.UserTaskSymbol",
			"x": 307,
			"y": 88,
			"width": 100,
			"height": 60,
			"object": "ea927550-f829-41ef-8857-52ce52b8afaf"
		},
		"965bc667-3db6-473a-9a41-49c66a377078": {
			"classDefinition": "com.sap.bpm.wfs.ui.SequenceFlowSymbol",
			"points": "357,118 495,118",
			"sourceSymbol": "b882bf64-a056-4774-b545-eb3a5df60381",
			"targetSymbol": "59c820a9-2322-4654-8e90-dc008522bd7f",
			"object": "458cfe12-f543-4710-bf1c-4e25011a4699"
		},
		"59c820a9-2322-4654-8e90-dc008522bd7f": {
			"classDefinition": "com.sap.bpm.wfs.ui.ScriptTaskSymbol",
			"x": 445,
			"y": 88,
			"width": 100,
			"height": 60,
			"object": "2c62dce0-1fe6-43ac-95e6-9d7cd2f3f85f"
		},
		"eb51c9da-fdae-498b-b4bf-124364032ed4": {
			"classDefinition": "com.sap.bpm.wfs.ui.SequenceFlowSymbol",
			"points": "495,116.75 633.5,116.75",
			"sourceSymbol": "59c820a9-2322-4654-8e90-dc008522bd7f",
			"targetSymbol": "53e54950-7757-4161-82c9-afa7e86cff2c",
			"object": "4f39c179-0e81-407f-8812-9a15d8fe674f"
		},
		"62d7f4ed-4063-4c44-af8b-39050bd44926": {
			"classDefinition": "com.sap.bpm.wfs.LastIDs",
			"sequenceflow": 4,
			"startevent": 1,
			"endevent": 1,
			"usertask": 1,
			"scripttask": 2
		}
	}
}