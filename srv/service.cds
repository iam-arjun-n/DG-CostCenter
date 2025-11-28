using com.deloitte.mdg.costcenter as db from '../db/data-model';

service CostCenterService {
  entity CostCenterRequests as projection on db.CostCenterRequests;
  entity CostCenterBasicData as projection on db.CostCenterBasicData;
  entity CostCenterComments as projection on db.CostCenterComments;
}