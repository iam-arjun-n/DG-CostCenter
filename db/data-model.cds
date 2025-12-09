namespace com.deloitte.mdg.costcenter;

using {
  cuid,
  managed
} from '@sap/cds/common';

@assert.range
type RequestStatus  : String enum {
  Draft;
  Submitted;
  Cancelled;
  Error;
  Rejected;
  Approved;
}

@assert.range
type WorkflowStatus : String enum {
  NotStarted;
  InApproval;
  Completed;
  Rejected;
}

type RequestType    : String enum {
  Create;
  Change;
  Extend;
}

entity CostCenterComments : managed {
  key ID          : UUID;
      request     : Association to CostCenterRequests;
      user        : String(80);
      role        : String(20);
      commentText : String(500);
}


entity CostCenterRequests : managed {
  key requestId      : String(11);
      requestType    : RequestType;
      workflowStatus : WorkflowStatus;
      requestStatus  : RequestStatus;
      createdByName  : String(80);
      costCenterData : Composition of many CostCenterBasicData
                         on costCenterData.request = $self;
      comments       : Composition of many CostCenterComments
                         on comments.request = $self;
}

entity CostCenterBasicData : cuid {
  key ID                   : UUID;
      controllingArea      : String(4);
      costCenter           : String(10);
      validFrom            : Date;
      validTo              : Date;
      name                 : String(100);
      description          : String(255);
      userResponsible      : String(50);
      personResponsible    : String(50);
      department           : String(50);
      costCenterCategory   : String(50);
      hierarchyArea        : String(50);
      companyCode          : String(10);
      businessArea         : String(10);
      currency             : String(3);
      profitCenter         : String(10);
      //Control Tab
      recordQuantity       : Boolean;
      actualPrimaryCosts   : Boolean;
      actualSecondaryCosts : Boolean;
      planPrimaryCosts     : Boolean;
      planSecondaryCosts   : Boolean;
      actualRevenue        : Boolean;
      planRevenue          : Boolean;
      commitmentUpdate     : Boolean;
      request              : Association to CostCenterRequests;
}
