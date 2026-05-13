import { useStore } from '../store/useStore';

import "./UnsavedChangesDialog.css";

export const UnsavedChangesDialog = () => {
  const isOpen = useStore((s) => s.showUnsavedDialog);
  const saveChanges = useStore((s) => s.saveChanges);
  const discardChanges = useStore((s) => s.discardChanges);
  const cancelConfirmation = useStore((s) => s.cancelConfirmation);

  if (!isOpen) return null;

  return (
    <div className="unsaved-dialog-overlay" onClick={cancelConfirmation}>
      <div className="unsaved-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="unsaved-dialog-header">
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div className="unsaved-dialog-title">저장되지 않은 변경사항</div>
        </div>
        <div className="unsaved-dialog-body">
          편집 모드에서 변경된 내용이 있습니다. 변경사항을 저장하시겠습니까?
          저장하지 않으면 모든 변경사항이 취소됩니다.
        </div>
        <div className="unsaved-dialog-footer">
          <button 
            className="grafana-btn grafana-btn-secondary" 
            onClick={cancelConfirmation}
          >
            취소
          </button>
          <button 
            className="grafana-btn btn-discard" 
            onClick={discardChanges}
          >
            저장 안 함
          </button>
          <button 
            className="grafana-btn grafana-btn-primary" 
            onClick={saveChanges}
            style={{ minWidth: '80px' }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
