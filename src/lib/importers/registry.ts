import { ImportDataset } from '@prisma/client';
import type { DatasetImporter } from '@/lib/importers/types';
import { agentMasterImporter } from '@/lib/importers/datasets/agentMaster';
import { posWarehouseImporter } from '@/lib/importers/datasets/posWarehouse';
import { materialDataImporter } from '@/lib/importers/datasets/materialData';
import { warehouseCancelImporter } from '@/lib/importers/datasets/warehouseCancel';
import { terminalLoginImporter } from '@/lib/importers/datasets/terminalLogin';
import { dailyCancellationImporter } from '@/lib/importers/datasets/dailyCancellation';
import { simDataImporter } from '@/lib/importers/datasets/simData';
import { receiptsImporter } from '@/lib/importers/datasets/receipts';
import { agentCheckpointImporter } from '@/lib/importers/datasets/agentCheckpoint';

export const DATASET_IMPORTERS: Record<ImportDataset, DatasetImporter> = {
  AGENT_MASTER: agentMasterImporter,
  POS_WAREHOUSE: posWarehouseImporter,
  MATERIAL_DATA: materialDataImporter,
  WAREHOUSE_CANCEL: warehouseCancelImporter,
  TERMINAL_LOGIN: terminalLoginImporter,
  DAILY_CANCELLATION: dailyCancellationImporter,
  SIM_DATA: simDataImporter,
  RECEIPTS: receiptsImporter,
  AGENT_CHECKPOINT: agentCheckpointImporter
};

export const DATASET_LABELS: Record<ImportDataset, string> = {
  AGENT_MASTER: 'Agent Master',
  POS_WAREHOUSE: 'POS Warehouse',
  MATERIAL_DATA: 'Material Data',
  WAREHOUSE_CANCEL: 'Warehouse Cancel',
  TERMINAL_LOGIN: 'Terminal Login',
  DAILY_CANCELLATION: 'Daily Agent Cancellation',
  SIM_DATA: 'SIM Data',
  RECEIPTS: 'Receipts',
  AGENT_CHECKPOINT: 'Agent Checkpoint (Clearance Audit)'
};
