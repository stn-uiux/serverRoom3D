import type { HierarchyNode, RegisteredDevice, Rack } from "../types";

// ─── Default Node IDs (고정 상수) ──────────────────────────────────────────────

// depth 1
export const ROOT_NODE_ID = "stn-root";
// depth 2
export const SUDOGWON_NODE_ID = "sudogwon";
export const CHUNGCHEONG_NODE_ID = "chungcheong";
// depth 3
export const GYEONGGI_NODE_ID = "gyeonggi";
export const DAEJEON_CITY_NODE_ID = "daejeon-city";
// depth 4
export const GWACHEON_CENTER_NODE_ID = "gwacheon-center";
export const DAEJEON_CENTER_NODE_ID = "daejeon-center";
// depth 5 (rooms)
export const GWACHEON_NODE_ID = "gwacheon-room-1f"; // Keep same var name for backwards compat
export const GWACHEON_ROOM_2F_NODE_ID = "gwacheon-room-2f"; 
export const DAEJEON_NODE_ID = "daejeon-room-1f"; // Keep same var name for backwards compat
export const NONE_NODE_ID = "none";

// ─── Default Tree ──────────────────────────────────────────────────────────────

/** 5-Depth Tree: STN \> 지역 \> 도시 \> 센터 \> 서버실 */
export const getDefaultNodes = (): HierarchyNode[] => [
  // Depth 1
  { nodeId: ROOT_NODE_ID, parentId: null, name: "STN", type: "root", order: 0 },
  // Depth 2
  { nodeId: SUDOGWON_NODE_ID, parentId: ROOT_NODE_ID, name: "수도권", type: "group", order: 0 },
  { nodeId: CHUNGCHEONG_NODE_ID, parentId: ROOT_NODE_ID, name: "충청권", type: "group", order: 1 },
  // Depth 3
  { nodeId: GYEONGGI_NODE_ID, parentId: SUDOGWON_NODE_ID, name: "경기", type: "group", order: 0 },
  { nodeId: DAEJEON_CITY_NODE_ID, parentId: CHUNGCHEONG_NODE_ID, name: "대전", type: "group", order: 0 },
  // Depth 4
  { nodeId: GWACHEON_CENTER_NODE_ID, parentId: GYEONGGI_NODE_ID, name: "과천센터", type: "group", order: 0 },
  { nodeId: DAEJEON_CENTER_NODE_ID, parentId: DAEJEON_CITY_NODE_ID, name: "대전센터", type: "group", order: 0 },
  // Depth 5
  { nodeId: GWACHEON_NODE_ID, parentId: GWACHEON_CENTER_NODE_ID, name: "1층 서버실", type: "group", order: 0 },
  { nodeId: GWACHEON_ROOM_2F_NODE_ID, parentId: GWACHEON_CENTER_NODE_ID, name: "2층 통신실", type: "group", order: 1 },
  { nodeId: DAEJEON_NODE_ID, parentId: DAEJEON_CENTER_NODE_ID, name: "1층 서버실", type: "group", order: 0 },
];

// ─── Tree Traversal Utilities ──────────────────────────────────────────────────

/** 직계 자식 노드 반환 (order 순 정렬) */
export const getChildren = (
  nodes: HierarchyNode[],
  parentId: string | null,
): HierarchyNode[] =>
  nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order);

/** 지정 노드 + 하위 전체 nodeId 집합 반환 (자기 포함) */
export const getSubtreeNodeIds = (
  nodes: HierarchyNode[],
  nodeId: string,
): Set<string> => {
  const result = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.add(current);
    for (const child of nodes) {
      if (child.parentId === current && !result.has(child.nodeId)) {
        stack.push(child.nodeId);
      }
    }
  }
  return result;
};

/** root까지 조상 경로 배열 반환 [root, ..., parent, self] (breadcrumb용) */
export const getAncestorPath = (
  nodes: HierarchyNode[],
  nodeId: string | null,
): HierarchyNode[] => {
  if (!nodeId) return [];
  const path: HierarchyNode[] = [];
  let current = nodes.find((n) => n.nodeId === nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? nodes.find((n) => n.nodeId === current!.parentId)
      : undefined;
  }
  return path;
};

/** root 노드 찾기 */
export const getRootNode = (
  nodes: HierarchyNode[],
): HierarchyNode | undefined => nodes.find((n) => n.parentId === null);

/** 노드 ID로 노드 찾기 */
export const findNode = (
  nodes: HierarchyNode[],
  nodeId: string | null,
): HierarchyNode | undefined => {
  if (!nodeId) return undefined;
  return nodes.find((n) => n.nodeId === nodeId);
};

/** 특정 노드가 leaf인지 (자식 없는지) 확인 */
export const isLeafNode = (
  nodes: HierarchyNode[],
  nodeId: string,
): boolean => !nodes.some((n) => n.parentId === nodeId);

// ─── Migration Helpers ─────────────────────────────────────────────────────────

/** 이전 groupName → nodeId 매핑 (하위 호환) */
export const migrateGroupNameToNodeId = (
  groupName: string,
): string => {
  switch (groupName) {
    case "과천":
    case "gwacheon":
      return GWACHEON_NODE_ID;
    case "대전":
    case "daejeon":
      return DAEJEON_NODE_ID;
    default:
      return groupName; // return as is if not a known legacy name
  }
};

/** 노드 ID를 기반으로 노드 이름을 로버스트하게 반환 (fallback 포함) */
export const getNodeName = (
  nodes: HierarchyNode[],
  nodeId: string | null,
): string => {
  if (!nodeId || nodeId === NONE_NODE_ID) return "없음";
  
  // 1. Direct match
  const direct = findNode(nodes, nodeId);
  if (direct) return direct.name;
  
  // 2. Try migration mapping
  const migratedId = migrateGroupNameToNodeId(nodeId);
  if (migratedId !== nodeId) {
    const migrated = findNode(nodes, migratedId);
    if (migrated) return migrated.name;
  }
  
  // 3. Known ID logic
  if (nodeId === GWACHEON_NODE_ID || nodeId === "gwacheon") return "1층 서버실";
  if (nodeId === DAEJEON_NODE_ID || nodeId === "daejeon") return "1층 서버실";
  
  return nodeId; // Final fallback
};

/** 노드의 깊이 반환 (root = 1) */
export const getNodeDepth = (nodes: HierarchyNode[], nodeId: string | null): number => {
  if (!nodeId) return 0;
  const path = getAncestorPath(nodes, nodeId);
  return path.length;
};

/** 노드의 전체 경로 이름 반환 (예: "STN > 수도권 > 경기") */
export const getFullPath = (nodes: HierarchyNode[], nodeId: string | null): string => {
  if (!nodeId) return "";
  const path = getAncestorPath(nodes, nodeId);
  if (path.length === 0) return "";
  return path.map((n) => n.name).join(" > ");
};

/** 특정 노드 및 모든 하위 노드의 전체 장비 개수 합산 반환 */
export const getSubtreeEquipmentCount = (
  nodes: HierarchyNode[],
  registeredDevices: RegisteredDevice[],
  nodeId: string,
): number => {
  const descendantIds = getSubtreeNodeIds(nodes, nodeId);
  return registeredDevices.filter((rd) => descendantIds.has(rd.deviceGroupId || '')).length;
};

/** 특정 노드의 직계 장비 개수 반환 (등록 장비 기준) */
export const getNodeEquipmentCount = (
  registeredDevices: RegisteredDevice[],
  nodeId: string | "ALL",
): number => {
  if (nodeId === "ALL") return registeredDevices.length;
  return registeredDevices.filter((rd) => rd.deviceGroupId === nodeId).length;
};

/** 특정 노드의 장비 목록 및 배치된 랙 정보 반환 */
export const getNodeDevices = (
  nodeId: string,
  registeredDevices: RegisteredDevice[],
  racks: Rack[],
): { device: RegisteredDevice; rackId: string | null; instanceId: string | null }[] => {
  const nodeRegDevices = registeredDevices.filter((rd) => rd.deviceGroupId === nodeId);

  return nodeRegDevices.map((rd) => {
    let foundRackId: string | null = null;
    let foundInstanceId: string | null = null;
    let foundPortStates: any[] | undefined = undefined;
    for (const r of racks) {
      const deviceInstance = r.devices.find((d) => d.deviceId === rd.deviceId);
      if (deviceInstance) {
        foundRackId = r.rackId;
        foundInstanceId = deviceInstance.itemId;
        foundPortStates = deviceInstance.portStates;
        break;
      }
    }
    return { 
      device: rd, 
      rackId: foundRackId, 
      instanceId: foundInstanceId,
      portStates: foundPortStates 
    };
  });
};

/** 특정 노드 및 모든 하위 노드에 속한 장비 목록 및 배치 정보를 반환 (누적) */
export const getSubtreeDevices = (
  nodes: HierarchyNode[],
  nodeId: string,
  registeredDevices: RegisteredDevice[],
  racks: Rack[],
): { 
  device: RegisteredDevice; 
  rackId: string | null; 
  instanceId: string | null;
  portStates: any[] | undefined;
}[] => {
  const descendantIds = getSubtreeNodeIds(nodes, nodeId);
  const nodeRegDevices = registeredDevices.filter((rd) => descendantIds.has(rd.deviceGroupId || ''));

  return nodeRegDevices.map((rd) => {
    let foundRackId: string | null = null;
    let foundInstanceId: string | null = null;
    let foundPortStates: any[] | undefined = undefined;
    for (const r of racks) {
      const deviceInstance = r.devices.find((d) => d.deviceId === rd.deviceId);
      if (deviceInstance) {
        foundRackId = r.rackId;
        foundInstanceId = deviceInstance.itemId;
        foundPortStates = deviceInstance.portStates;
        break;
      }
    }
    return { 
      device: rd, 
      rackId: foundRackId, 
      instanceId: foundInstanceId,
      portStates: foundPortStates 
    };
  });
};


/**
 * 특정 경로 문자열(예: "STN > 수도권 > 경기")을 기반으로 노드들을 조회하거나 생성 정보를 생성합니다.
 * 실제 Store 반영은 upsertNodes 등을 통해 수행되어야 합니다.
 */
export const resolvePathToNodeId = (
  nodes: HierarchyNode[],
  pathStr: string,
  existingNewNodes: HierarchyNode[] = [],
): { nodeId: string; newNodes: HierarchyNode[] } => {
  const parts = pathStr.split(">").map((s) => s.trim());
  const allNodes = [...nodes, ...existingNewNodes];
  const createdNodes: HierarchyNode[] = [];

  let currentParentId: string | null = null;
  let lastNodeId = "";

  for (let i = 0; i < parts.length; i++) {
    const partName = parts[i];
    // 현재 부모 아래에 같은 이름을 가진 노드가 있는지 확인
    const found = allNodes.find(
      (n) => n.name.trim().toLowerCase() === partName.toLowerCase() && n.parentId === currentParentId,
    );

    if (found) {
      currentParentId = found.nodeId;
      lastNodeId = found.nodeId;
    } else {
      // 노드 생성
      const newNodeId = `node-${Math.random().toString(36).substring(2, 9)}`;
      const newNode: HierarchyNode = {
        nodeId: newNodeId,
        parentId: currentParentId,
        name: partName,
        type: i === 0 ? "root" : "group",
        order: 99, // 신규 생성 노드는 우선 뒤로 배치
      };
      createdNodes.push(newNode);
      allNodes.push(newNode);
      currentParentId = newNodeId;
      lastNodeId = newNodeId;
    }
  }

  return { nodeId: lastNodeId, newNodes: createdNodes };
};
