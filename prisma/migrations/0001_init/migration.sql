-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ImportDataset" AS ENUM ('AGENT_MASTER', 'POS_WAREHOUSE', 'MATERIAL_DATA', 'WAREHOUSE_CANCEL', 'TERMINAL_LOGIN', 'DAILY_CANCELLATION', 'SIM_DATA', 'RECEIPTS', 'AGENT_CHECKPOINT');
CREATE TYPE "ImportStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'SUCCEEDED_WITH_ERRORS', 'FAILED');
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateTable: roles
CREATE TABLE "roles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateTable: users
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: permissions
CREATE TABLE "permissions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateTable: role_permissions
CREATE TABLE "role_permissions" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: audit_log
CREATE TABLE "audit_log" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "recordId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_log_entity_recordId_idx" ON "audit_log"("entity", "recordId");
CREATE INDEX "audit_log_userId_idx" ON "audit_log"("userId");
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: import_batches
CREATE TABLE "import_batches" (
  "id" TEXT NOT NULL,
  "dataset" "ImportDataset" NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "triggeredById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "rowsRead" INTEGER NOT NULL DEFAULT 0,
  "rowsInserted" INTEGER NOT NULL DEFAULT 0,
  "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
  "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
  "rowsRejected" INTEGER NOT NULL DEFAULT 0,
  "status" "ImportStatus" NOT NULL DEFAULT 'RUNNING',
  "errorSummary" TEXT,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_batches_dataset_startedAt_idx" ON "import_batches"("dataset", "startedAt");
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: import_rejected_rows
CREATE TABLE "import_rejected_rows" (
  "id" TEXT NOT NULL,
  "importBatchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawData" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  CONSTRAINT "import_rejected_rows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_rejected_rows_importBatchId_idx" ON "import_rejected_rows"("importBatchId");
ALTER TABLE "import_rejected_rows" ADD CONSTRAINT "import_rejected_rows_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: teams / regions / live_ops / team_leaders
CREATE TABLE "teams" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "teams_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

CREATE TABLE "regions" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "regions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

CREATE TABLE "live_ops" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "live_ops_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "live_ops_name_key" ON "live_ops"("name");

CREATE TABLE "team_leaders" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "team_leaders_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "team_leaders_name_key" ON "team_leaders"("name");

-- CreateTable: agents
CREATE TABLE "agents" (
  "agentCode" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "teamId" TEXT,
  "regionId" TEXT,
  "liveOpsId" TEXT,
  "teamLeaderId" TEXT,
  "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agents_pkey" PRIMARY KEY ("agentCode")
);
CREATE INDEX "agents_agentName_idx" ON "agents"("agentName");
ALTER TABLE "agents" ADD CONSTRAINT "agents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_liveOpsId_fkey" FOREIGN KEY ("liveOpsId") REFERENCES "live_ops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "team_leaders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: agent_assignment_history
CREATE TABLE "agent_assignment_history" (
  "id" TEXT NOT NULL,
  "agentCode" TEXT NOT NULL,
  "fieldChanged" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_assignment_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_assignment_history_agentCode_idx" ON "agent_assignment_history"("agentCode");
ALTER TABLE "agent_assignment_history" ADD CONSTRAINT "agent_assignment_history_agentCode_fkey" FOREIGN KEY ("agentCode") REFERENCES "agents"("agentCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: pos_events
CREATE TABLE "pos_events" (
  "id" TEXT NOT NULL,
  "importBatchId" TEXT,
  "sourceRowHash" TEXT NOT NULL,
  "occurrenceIndex" INTEGER NOT NULL DEFAULT 1,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actionDate" TIMESTAMP(3),
  "posSource" TEXT,
  "serialNumber" TEXT NOT NULL,
  "serialKey" TEXT NOT NULL,
  "imei" TEXT,
  "imei2" TEXT,
  "posType" TEXT,
  "boxNumber" TEXT,
  "category" TEXT,
  "modelType" TEXT,
  "paymob" TEXT,
  "sahlOrNot" TEXT,
  "cibOrNot" TEXT,
  "posStatus" TEXT,
  "agentCode" TEXT,
  "assignedTeam" TEXT,
  "assigningName" TEXT,
  "assigningDate" TIMESTAMP(3),
  "deploymentDate" TIMESTAMP(3),
  "mid" TEXT,
  "tid" TEXT,
  "receiptNumber" TEXT,
  "receiptDate" TIMESTAMP(3),
  "city" TEXT,
  "zone" TEXT,
  "address" TEXT,
  "comment" TEXT,
  "stockStatus" TEXT,
  "tidVal" TEXT,
  "city2" TEXT,
  "region" TEXT,
  "country" TEXT,
  CONSTRAINT "pos_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pos_events_sourceRowHash_occurrenceIndex_key" ON "pos_events"("sourceRowHash", "occurrenceIndex");
CREATE INDEX "pos_events_serialKey_idx" ON "pos_events"("serialKey");
CREATE INDEX "pos_events_agentCode_idx" ON "pos_events"("agentCode");
CREATE INDEX "pos_events_actionDate_idx" ON "pos_events"("actionDate");
CREATE INDEX "pos_events_posStatus_idx" ON "pos_events"("posStatus");
CREATE INDEX "pos_events_tid_serialKey_idx" ON "pos_events"("tid", "serialKey");

-- CreateTable: warehouse_cancel_returns
CREATE TABLE "warehouse_cancel_returns" (
  "id" TEXT NOT NULL,
  "importBatchId" TEXT,
  "sourceRowHash" TEXT NOT NULL,
  "occurrenceIndex" INTEGER NOT NULL DEFAULT 1,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedDate" TIMESTAMP(3),
  "serial" TEXT NOT NULL,
  "serialKey" TEXT NOT NULL,
  "imei" TEXT,
  "mid" TEXT,
  "tid" TEXT,
  "status" TEXT,
  "cancellationOrExchange" TEXT,
  "cancellationDate" TIMESTAMP(3),
  "receiptNumber" TEXT,
  "agentCode" TEXT,
  "team" TEXT,
  "name" TEXT,
  "box" TEXT,
  "cable" TEXT,
  "sim" TEXT,
  "adapter" TEXT,
  "modelType" TEXT,
  "paymob" TEXT,
  "cibOrNot" TEXT,
  "comment" TEXT,
  "city" TEXT,
  "region" TEXT,
  "country" TEXT,
  "tidSerialKey" TEXT NOT NULL,
  CONSTRAINT "warehouse_cancel_returns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warehouse_cancel_returns_sourceRowHash_occurrenceIndex_key" ON "warehouse_cancel_returns"("sourceRowHash", "occurrenceIndex");
CREATE INDEX "warehouse_cancel_returns_tidSerialKey_idx" ON "warehouse_cancel_returns"("tidSerialKey");
CREATE INDEX "warehouse_cancel_returns_receivedDate_idx" ON "warehouse_cancel_returns"("receivedDate");
CREATE INDEX "warehouse_cancel_returns_agentCode_idx" ON "warehouse_cancel_returns"("agentCode");

-- CreateTable: material_movements
CREATE TABLE "material_movements" (
  "id" TEXT NOT NULL,
  "importBatchId" TEXT,
  "sourceRowHash" TEXT NOT NULL,
  "occurrenceIndex" INTEGER NOT NULL DEFAULT 1,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moveDate" TIMESTAMP(3),
  "orderType" TEXT NOT NULL,
  "materialType" TEXT NOT NULL,
  "qty" DECIMAL(14,2) NOT NULL,
  "agentCode" TEXT,
  "team" TEXT,
  "agentName" TEXT,
  "vendorName" TEXT,
  "city" TEXT,
  "region" TEXT,
  "country" TEXT,
  CONSTRAINT "material_movements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "material_movements_sourceRowHash_occurrenceIndex_key" ON "material_movements"("sourceRowHash", "occurrenceIndex");
CREATE INDEX "material_movements_moveDate_idx" ON "material_movements"("moveDate");
CREATE INDEX "material_movements_materialType_idx" ON "material_movements"("materialType");
CREATE INDEX "material_movements_agentCode_idx" ON "material_movements"("agentCode");

-- CreateTable: terminal_login
CREATE TABLE "terminal_login" (
  "id" TEXT NOT NULL,
  "importBatchId" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "serialNumber" TEXT NOT NULL,
  "serialKey" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "deploymentDate" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "terminal_login_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "terminal_login_serialKey_terminalId_deploymentDate_key" ON "terminal_login"("serialKey", "terminalId", "deploymentDate");
CREATE INDEX "terminal_login_serialKey_deploymentDate_idx" ON "terminal_login"("serialKey", "deploymentDate");

-- CreateTable: daily_agent_cancellation
CREATE TABLE "daily_agent_cancellation" (
  "id" TEXT NOT NULL,
  "importBatchId" TEXT,
  "sourceRowHash" TEXT NOT NULL,
  "occurrenceIndex" INTEGER NOT NULL DEFAULT 1,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "team" TEXT,
  "region" TEXT,
  "city" TEXT,
  "tid" TEXT,
  "mid" TEXT,
  "cancelDate" TIMESTAMP(3),
  "imei" TEXT,
  "serial" TEXT,
  "serialKey" TEXT,
  "posModel" TEXT,
  "agentCode" TEXT,
  "agentName" TEXT,
  "source" TEXT,
  "ticketId" TEXT,
  "comment" TEXT,
  "warehouseReceived" BOOLEAN NOT NULL DEFAULT false,
  "tidSerialKey" TEXT,
  CONSTRAINT "daily_agent_cancellation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "daily_agent_cancellation_sourceRowHash_occurrenceIndex_key" ON "daily_agent_cancellation"("sourceRowHash", "occurrenceIndex");
CREATE INDEX "daily_agent_cancellation_tidSerialKey_idx" ON "daily_agent_cancellation"("tidSerialKey");
CREATE INDEX "daily_agent_cancellation_agentCode_idx" ON "daily_agent_cancellation"("agentCode");

-- CreateTable: sim_records
CREATE TABLE "sim_records" (
  "simSerial" TEXT NOT NULL,
  "operator" TEXT,
  "warehouseReceivedDate" TIMESTAMP(3),
  "assignDate" TIMESTAMP(3),
  "agentCode" TEXT,
  "agentName" TEXT,
  "team" TEXT,
  "importBatchId" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sim_records_pkey" PRIMARY KEY ("simSerial")
);
ALTER TABLE "sim_records" ADD CONSTRAINT "sim_records_agentCode_fkey" FOREIGN KEY ("agentCode") REFERENCES "agents"("agentCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: receipt_records
CREATE TABLE "receipt_records" (
  "receiptSerial" TEXT NOT NULL,
  "receiptType" TEXT,
  "warehouseReceivedDate" TIMESTAMP(3),
  "assignDate" TIMESTAMP(3),
  "agentCode" TEXT,
  "agentName" TEXT,
  "team" TEXT,
  "importBatchId" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_records_pkey" PRIMARY KEY ("receiptSerial")
);
ALTER TABLE "receipt_records" ADD CONSTRAINT "receipt_records_agentCode_fkey" FOREIGN KEY ("agentCode") REFERENCES "agents"("agentCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: agent_checkpoints
CREATE TABLE "agent_checkpoints" (
  "id" TEXT NOT NULL,
  "agentCode" TEXT NOT NULL,
  "auditDate" TIMESTAMP(3) NOT NULL,
  "importBatchId" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_checkpoints_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_checkpoints_agentCode_auditDate_key" ON "agent_checkpoints"("agentCode", "auditDate");
ALTER TABLE "agent_checkpoints" ADD CONSTRAINT "agent_checkpoints_agentCode_fkey" FOREIGN KEY ("agentCode") REFERENCES "agents"("agentCode") ON DELETE CASCADE ON UPDATE CASCADE;
