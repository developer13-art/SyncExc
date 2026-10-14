import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Save, Send } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { NodeLibrary } from './components/NodeLibrary.jsx';
import { NodeConfigPanel } from './components/NodeConfigPanel.jsx';
import { WorkflowCanvas } from './components/WorkflowCanvas.jsx';
import { ValidationPanel } from './components/ValidationPanel.jsx';
import { useWorkflow } from '../../hooks/useAutomation.js';
import { automationApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkflowBuilder() {
  const { workflowId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const workflowQuery = useWorkflow(workflowId);

  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (workflowQuery.workflow) {
      setName(workflowQuery.workflow.name ?? '');
      setDescription(workflowQuery.workflow.description ?? '');
      setNodes(
        (workflowQuery.workflow.nodes ?? []).map((node) => ({
          ...node,
          position: node.position ?? { x: 100, y: 100 },
        })),
      );
      dispatch(uiActions.setPageTitle(`Edit: ${workflowQuery.workflow.name}`));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Automation', path: ROUTES.app.automation.overview },
          {
            label: workflowQuery.workflow.name,
            path: ROUTES.app.automation.workflow(workflowId),
          },
          { label: 'Builder', path: ROUTES.app.automation.edit(workflowId) },
        ]),
      );
    }
  }, [workflowQuery.workflow, dispatch, workflowId]);

  const nodeCatalog = workflowQuery.workflow?.nodeCatalog ?? [];
  const nodeSchemas = workflowQuery.workflow?.nodeSchemas ?? {};

  const handleDragStart = (e, nodeDef) => {
    e.dataTransfer.setData('application/json', JSON.stringify(nodeDef));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddNode = (nodeDef) => {
    const id = `${nodeDef.type}-${Date.now()}`;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: nodeDef.type,
        category: nodeDef.category,
        label: nodeDef.label,
        summary: nodeDef.description,
        config: {},
        position: { x: 100 + (prev.length * 40) % 600, y: 100 + (prev.length * 60) % 500 },
      },
    ]);
    setSelectedNodeId(id);
  };

  const handleDropNode = useCallback((nodeDef, position) => {
    const id = `${nodeDef.type}-${Date.now()}`;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: nodeDef.type,
        category: nodeDef.category,
        label: nodeDef.label,
        summary: nodeDef.description,
        config: {},
        position,
      },
    ]);
    setSelectedNodeId(id);
  }, []);

  const handleNodeMove = (nodeId, position) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, position } : n)),
    );
  };

  const handleSelectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  const handleDeleteNode = (nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const handleConfigChange = (nodeId, config) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, config } : n)),
    );
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await automationApi.validateWorkflow(workflowId, {
        nodes,
        name,
        description,
      });
      setValidation(result);
    } catch (err) {
      toast.error('Validation failed', { description: getErrorMessage(err) });
    } finally {
      setValidating(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await automationApi.updateWorkflow(workflowId, {
        name,
        description,
        nodes,
      });
      toast.success('Draft saved');
    } catch (err) {
      toast.error('Save failed', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validation?.valid) {
      toast.error('Validate the workflow before publishing');
      return;
    }
    try {
      await automationApi.publishWorkflow(workflowId, {
        nodes,
        name,
        description,
      });
      toast.success('Version published');
    } catch (err) {
      toast.error('Publish failed', { description: getErrorMessage(err) });
    }
  };

  if (workflowQuery.isLoading) {
    return <LoadingState label="Loading workflow" />;
  }

  if (workflowQuery.error || !workflowQuery.workflow) {
    return (
      <ErrorState
        title="Unable to load workflow"
        description="This workflow could not be retrieved."
        onRetry={workflowQuery.refetch}
      />
    );
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.automation.workflow(workflowId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workflow name"
          className="max-w-xs"
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="max-w-md"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handleValidate} disabled={validating}>
            <CheckCircle2 className="h-4 w-4" />
            {validating ? 'Validating…' : 'Validate'}
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={handlePublish}>
            <Send className="h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-lg border border-border">
        <div className="w-64 shrink-0">
          <NodeLibrary
            nodes={nodeCatalog}
            onDragStart={handleDragStart}
            onAddNode={handleAddNode}
          />
        </div>

        <div className="flex-1">
          <WorkflowCanvas
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            onDeleteNode={handleDeleteNode}
            onNodeMove={handleNodeMove}
            onDropNode={handleDropNode}
          />
        </div>

        <div className="w-80 shrink-0">
          {selectedNode ? (
            <NodeConfigPanel
              node={selectedNode}
              schema={nodeSchemas[selectedNode.type]}
              onChange={handleConfigChange}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : validation ? (
            <div className="h-full overflow-y-auto scrollbar-thin p-4">
              <ValidationPanel result={validation} onValidate={handleValidate} isValidating={validating} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
              Select a node to configure it, or click Validate to check the workflow.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}