import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Save, Send } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
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
  const queryClient = useQueryClient();
  const toast = useToast();

  const workflowQuery = useWorkflow(workflowId, { includeNodeCatalog: true });

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [loadedWorkflowId, setLoadedWorkflowId] = useState(null);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (
      workflowQuery.workflow &&
      !workflowQuery.isBuilderLoading &&
      loadedWorkflowId !== workflowId
    ) {
      const workflow = workflowQuery.workflow;
      setName(workflow.name ?? '');
      setDescription(workflow.description ?? '');
      setNodes(
        (workflow.nodes ?? []).map((node) => ({
          ...node,
          position: node.position ?? { x: 100, y: 100 },
        })),
      );
      setEdges(workflow.edges ?? []);
      setLoadedWorkflowId(workflowId);
      dispatch(uiActions.setPageTitle(`Edit: ${workflow.name}`));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Automation', path: ROUTES.app.automation.overview },
          {
            label: workflow.name,
            path: ROUTES.app.automation.workflow(workflowId),
          },
          { label: 'Builder', path: ROUTES.app.automation.edit(workflowId) },
        ]),
      );
    }
  }, [workflowQuery.workflow, workflowQuery.isBuilderLoading, loadedWorkflowId, dispatch, workflowId]);

  const nodeCatalog = workflowQuery.nodeCatalog ?? [];
  const nodeSchemas = Object.fromEntries(
    nodeCatalog.map((node) => [node.type, node.schema ?? { fields: [] }]),
  );

  const handleDragStart = (e, nodeDef) => {
    e.dataTransfer.setData('application/json', JSON.stringify(nodeDef));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddNode = (nodeDef) => {
    const id = `${nodeDef.type}-${Date.now()}`;
    setValidation(null);
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
    setValidation(null);
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
    setValidation(null);
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, position } : n)),
    );
  };

  const handleSelectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  const handleDeleteNode = (nodeId) => {
    setValidation(null);
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const handleConfigChange = (nodeId, config) => {
    setValidation(null);
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, config } : n)),
    );
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await automationApi.validateWorkflow(workflowId, {
        nodes,
        edges,
        input: {},
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
      });
      await automationApi.createDraftVersion(workflowId, { nodes, edges, input: {} });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['automation', 'workflow', workflowId] }),
        queryClient.invalidateQueries({ queryKey: ['automation', 'versions', workflowId] }),
        queryClient.invalidateQueries({ queryKey: ['automation', 'workflows'] }),
      ]);
      toast.success('Draft saved');
    } catch (err) {
      toast.error('Save failed', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await automationApi.validateWorkflow(workflowId, { nodes, edges, input: {} });
      setValidation(result);
      if (!result.valid) {
        toast.error('Workflow validation failed', {
          description: result.errors?.map((error) => error.message).filter(Boolean).join('; '),
        });
        return;
      }
      await automationApi.updateWorkflow(workflowId, { name, description });
      const version = await automationApi.createDraftVersion(workflowId, { nodes, edges, input: {} });
      await automationApi.publishWorkflow(workflowId, { versionId: version.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['automation', 'workflow', workflowId] }),
        queryClient.invalidateQueries({ queryKey: ['automation', 'versions', workflowId] }),
        queryClient.invalidateQueries({ queryKey: ['automation', 'workflows'] }),
      ]);
      toast.success('Version published');
    } catch (err) {
      toast.error('Publish failed', { description: getErrorMessage(err) });
    } finally {
      setPublishing(false);
    }
  };

  if (workflowQuery.isBuilderLoading) {
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
  if (workflowQuery.nodeCatalogError) {
    return (
      <ErrorState
        title="Node library unavailable"
        description={getErrorMessage(workflowQuery.nodeCatalogError)}
        onRetry={workflowQuery.refetchNodeCatalog}
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
          <Button variant="outline" onClick={handleValidate} disabled={validating || saving || publishing}>
            <CheckCircle2 className="h-4 w-4" />
            {validating ? 'Validating…' : 'Validate'}
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || validating || publishing}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={handlePublish} disabled={publishing || saving || validating}>
            <Send className="h-4 w-4" />
            {publishing ? 'Publishing…' : 'Publish'}
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