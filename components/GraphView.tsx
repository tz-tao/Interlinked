import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useCRM } from '../context/CRMContext';
import { GraphNode, GraphLink, GraphViewMode, Tag, Contact, GraphState } from '../types';
import { categorizeContactsByDimension } from '../services/geminiService';
import { Search, ZoomIn, ZoomOut, RefreshCw, X, Sparkles, Loader2, ChevronDown, SlidersHorizontal, ArrowRight } from 'lucide-react';

interface GraphViewProps {
    onNodeClick: (id: string) => void;
    graphState: GraphState;
    setGraphState: React.Dispatch<React.SetStateAction<GraphState>>;
}

export const GraphView: React.FC<GraphViewProps> = ({ onNodeClick, graphState, setGraphState }) => {
    const { contacts, tags, addTag, batchUpdateContacts } = useCRM();
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Destructure persistent state
    const { searchTerm, dimension, customDimensionInput, customMappings, currentClusterIndex } = graphState;

    // Local UI State
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Cluster State (Derived locally, but index is persisted)
    const [matchClusters, setMatchClusters] = useState<GraphNode[][]>([]);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const prevSearchTerm = useRef(searchTerm);

    // D3 Refs
    const nodeSelectionRef = useRef<any>(null);
    const linkSelectionRef = useRef<any>(null);
    const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

    // Color scale
    const colorScale = useMemo(() => d3.scaleOrdinal(d3.schemeTableau10), []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Update State Helpers
    const updateGraphState = (updates: Partial<GraphState>) => {
        setGraphState(prev => ({ ...prev, ...updates }));
    };

    const resetZoom = () => {
        if (svgRef.current && zoomBehaviorRef.current && containerRef.current && simulationRef.current) {
            const nodes = simulationRef.current.nodes();
            if (nodes.length === 0) return;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(d => {
                if (typeof d.x === 'number' && typeof d.y === 'number') {
                    minX = Math.min(minX, d.x); minY = Math.min(minY, d.y);
                    maxX = Math.max(maxX, d.x); maxY = Math.max(maxY, d.y);
                }
            });

            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            const padding = 50;

            if (minX !== Infinity && maxX !== -Infinity) {
                const dx = maxX - minX + (padding * 2);
                const dy = maxY - minY + (padding * 2);
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;

                let scale = Math.min(width / dx, height / dy);
                scale = Math.max(0.1, Math.min(1, scale));

                const transform = d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(scale)
                    .translate(-cx, -cy);

                d3.select(svgRef.current).transition().duration(750)
                    .call(zoomBehaviorRef.current.transform, transform);
            } else {
                d3.select(svgRef.current).transition().duration(750).call(
                    zoomBehaviorRef.current.transform,
                    d3.zoomIdentity
                );
            }
        }
    };

    const handleCustomDimensionSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        console.log('handleCustomDimensionSubmit called with:', customDimensionInput);
        if (!customDimensionInput.trim()) return;

        setIsDropdownOpen(false);
        updateGraphState({ customMappings: {} });

        const inputTerm = customDimensionInput.trim();
        const normalizedTerm = inputTerm.toLowerCase();

        const existingGlobalTag = tags?.find(t => t.name.toLowerCase() === normalizedTerm);
        const isUsedInContacts = contacts.some(c => c.tags?.some(t => t.toLowerCase() === normalizedTerm));

        console.log('existingGlobalTag:', existingGlobalTag);
        console.log('isUsedInContacts:', isUsedInContacts);

        if (existingGlobalTag || isUsedInContacts) {
            console.log('Using existing tag logic');
            const localMapping: Record<string, string> = {};
            const formattedLabel = existingGlobalTag ? existingGlobalTag.name : inputTerm.charAt(0).toUpperCase() + inputTerm.slice(1);

            contacts.forEach(c => {
                const hasTag = c.tags?.some(t => t.toLowerCase() === normalizedTerm);
                if (hasTag) {
                    localMapping[c.id] = formattedLabel;
                }
            });

            console.log('localMapping:', localMapping);
            updateGraphState({ dimension: formattedLabel, customMappings: localMapping });
        } else {
            console.log('Using AI categorization logic');
            updateGraphState({ dimension: inputTerm });
            setIsAnalyzing(true);
            console.log('Calling categorizeContactsByDimension with:', inputTerm);
            const mapping = await categorizeContactsByDimension(contacts, inputTerm);
            console.log('Received mapping:', mapping);

            updateGraphState({ customMappings: mapping });

            const uniqueNewTags = new Set<string>();
            Object.values(mapping).forEach(val => {
                if (val && val !== 'Other' && val !== 'Unknown' && val !== 'No') {
                    const norm = val.trim();
                    const exists = tags?.some(t => t.name.toLowerCase() === norm.toLowerCase()) || uniqueNewTags.has(norm);
                    if (!exists) uniqueNewTags.add(norm);
                }
            });

            uniqueNewTags.forEach(tagName => {
                addTag({
                    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    name: tagName,
                    color: 'bg-teal-100 text-teal-800'
                });
            });

            const contactUpdates: { id: string, updates: Partial<Contact> }[] = [];
            Object.entries(mapping).forEach(([contactId, val]) => {
                if (val && val !== 'Other' && val !== 'Unknown' && val !== 'No') {
                    const contact = contacts.find(c => c.id === contactId);
                    if (contact && !contact.tags?.includes(val)) {
                        contactUpdates.push({
                            id: contactId,
                            updates: { tags: [...(contact.tags || []), val] }
                        });
                    }
                }
            });

            if (contactUpdates.length > 0) {
                batchUpdateContacts(contactUpdates);
            }

            setIsAnalyzing(false);
        }
    };

    const handleResetDimension = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateGraphState({
            dimension: 'company',
            customDimensionInput: '',
            customMappings: {}
        });
        if (!searchTerm) {
            resetZoom();
        }
    };

    const handleClearSearch = () => {
        updateGraphState({ searchTerm: '' });
        resetZoom();
    };

    const normalize = (s: string) => (s || '').trim().toLowerCase();

    // Prepare Data
    const { nodes, links } = useMemo(() => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const nodeMap = new Map<string, GraphNode>();

        const getApproxWidth = (text: string, isGroup: boolean) => {
            const charWidth = 10;
            const base = isGroup ? 40 : 24;
            return base + ((text || '').length * charWidth) + 20;
        };

        contacts.forEach(c => {
            const node: GraphNode = {
                id: c.id,
                group: 1,
                name: c.name || 'Unknown',
                type: 'person',
                val: 10,
                role: c.role,
                company: c.company,
                industry: c.industry,
                tags: c.tags || [],
                width: getApproxWidth(c.name, false),
                height: 24,
                textWidth: 0
            };
            nodes.push(node);
            nodeMap.set(c.id, node);
        });

        const groupValues = new Set<string>();
        const isTagMode = dimension === 'tag';
        const hasCustomMappings = Object.keys(customMappings).length > 0;

        const isSpecificTag = !hasCustomMappings && tags?.some(t => t.name.toLowerCase() === dimension.toLowerCase());
        const isStandardField = ['company', 'industry', 'role', 'location'].includes(dimension);

        contacts.forEach(c => {
            if (hasCustomMappings) {
                const val = customMappings[c.id];
                if (val && val !== 'Unknown' && val !== 'Other' && val !== 'No') {
                    groupValues.add(val);
                }
            } else if (isSpecificTag) {
                const hasTag = c.tags?.some(t => normalize(t) === normalize(dimension));
                if (hasTag) groupValues.add(dimension);
            } else if (isStandardField) {
                const key = dimension as keyof typeof c;
                const val = c[key];
                if (typeof val === 'string' && val.trim()) {
                    groupValues.add(val.trim());
                }
            } else if (isTagMode) {
                c.tags?.forEach(t => {
                    if (t) groupValues.add(t.trim());
                });
            }
        });

        Array.from(groupValues).forEach((val, idx) => {
            const id = `grp-${dimension}-${normalize(val)}`;
            if (nodeMap.has(id)) return;

            const node: GraphNode = {
                id,
                group: 2,
                name: val,
                type: 'group',
                subtype: dimension,
                val: 20,
                width: getApproxWidth(val, true),
                height: 30,
                textWidth: 0
            };
            nodes.push(node);
            nodeMap.set(id, node);

            contacts.forEach(c => {
                let isLinked = false;

                if (hasCustomMappings) {
                    if (customMappings[c.id] === val) isLinked = true;
                } else if (isSpecificTag) {
                    if (c.tags?.some(t => normalize(t) === normalize(val))) isLinked = true;
                } else if (isStandardField) {
                    const key = dimension as keyof typeof c;
                    const cVal = c[key];
                    if (typeof cVal === 'string' && normalize(cVal) === normalize(val)) isLinked = true;
                } else if (isTagMode) {
                    if (c.tags?.some(t => normalize(t) === normalize(val))) isLinked = true;
                }

                if (isLinked) {
                    links.push({ source: c.id, target: id });
                }
            });
        });

        contacts.forEach(c => {
            c.linkedIds?.forEach(targetId => {
                if (nodeMap.has(targetId) && c.id !== targetId) {
                    const exists = links.some(l =>
                        (l.source === c.id && l.target === targetId) ||
                        (l.source === targetId && l.target === c.id)
                    );
                    if (!exists) links.push({ source: c.id, target: targetId });
                }
            });
        });

        return { nodes, links };
    }, [contacts, dimension, customMappings]);

    // Initialize Simulation
    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        if (simulationRef.current) simulationRef.current.stop();

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const g = svg.append("g");

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                transformRef.current = event.transform;
                g.attr("transform", event.transform);
            });

        svg.call(zoom);
        svg.call(zoom.transform, transformRef.current);
        zoomBehaviorRef.current = zoom;

        // Physics Tuning: Fix Overlap & Density
        const rectCollide = () => {
            let nodes: GraphNode[] = [];
            const padding = 100; // Increased padding to prevent overlaps
            function force(alpha: number) {
                const quadtree = d3.quadtree(nodes, d => d.x!, d => d.y!);
                for (const d of nodes) {
                    const r = (d.width || 50) + (d.height || 30);
                    const nx1 = d.x! - r, nx2 = d.x! + r, ny1 = d.y! - r, ny2 = d.y! + r;
                    quadtree.visit((quad, x1, y1, x2, y2) => {
                        if (!quad.length) {
                            const qd = (quad as d3.QuadtreeLeaf<GraphNode>).data;
                            if (qd !== d) {
                                const dx = d.x! - qd.x!, dy = d.y! - qd.y!;
                                const absX = Math.abs(dx), absY = Math.abs(dy);
                                const w = ((d.width || 0) + (qd.width || 0)) / 2 + padding;
                                const h = ((d.height || 0) + (qd.height || 0)) / 2 + padding;
                                if (absX < w && absY < h) {
                                    const ox = w - absX, oy = h - absY;
                                    if (ox < oy) {
                                        const sx = dx > 0 ? 1 : -1;
                                        const nudge = ox * 0.5 * alpha;
                                        d.vx! += sx * nudge; qd.vx! -= sx * nudge;
                                    } else {
                                        const sy = dy > 0 ? 1 : -1;
                                        const nudge = oy * 0.5 * alpha;
                                        d.vy! += sy * nudge; qd.vy! -= sy * nudge;
                                    }
                                }
                            }
                        }
                        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                    });
                }
            }
            force.initialize = (_: GraphNode[]) => nodes = _;
            return force;
        };

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(450)) // Increase link distance
            .force("charge", d3.forceManyBody().strength(-5000)) // Stronger repulsion
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", rectCollide());

        simulationRef.current = simulation;

        // Draw Links BEFORE Nodes
        const link = g.append("g")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", (d: any) => {
                return (typeof d.target === 'object' && d.target.type === 'group') ? 2 : 1;
            })
            .attr("stroke", "#000000");

        linkSelectionRef.current = link;

        let isDragging = false;
        let dragStartTime = 0;
        let hoveredNodeId: string | null = null;

        const getOpacity = (d: GraphNode) => {
            if (hoveredNodeId) {
                if (d.id === hoveredNodeId) return 1;
                const isNeighbor = links.some((l: any) =>
                    (l.source.id === hoveredNodeId && l.target.id === d.id) ||
                    (l.target.id === hoveredNodeId && l.source.id === d.id)
                );
                return isNeighbor ? 1 : 0.1;
            }

            if (searchTerm) {
                const t = searchTerm.toLowerCase();
                const isMatch =
                    (d.tags && d.tags.some(tag => tag.toLowerCase().includes(t))) ||
                    (d.type === 'group' && d.name.toLowerCase().includes(t)) ||
                    (d.type === 'person' && (
                        d.name.toLowerCase().includes(t) ||
                        d.company?.toLowerCase().includes(t) ||
                        d.role?.toLowerCase().includes(t) ||
                        d.industry?.toLowerCase().includes(t)
                    ));
                return isMatch ? 1 : 0.1;
            }
            return 1;
        };

        // Nodes
        const nodeGroup = g.append("g")
            .selectAll<SVGGElement, GraphNode>("g")
            .data(nodes)
            .join("g")
            .call(d3.drag<any, GraphNode>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                    isDragging = false;
                    dragStartTime = Date.now();
                })
                .on("drag", (event, d) => {
                    if (Date.now() - dragStartTime > 100) isDragging = true;
                    d.fx = event.x; d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                })
            )
            .on("click", (event, d: GraphNode) => {
                if (isDragging) return;
                event.stopPropagation();
                if (d.type === 'person') {
                    onNodeClick(d.id);
                }
            })
            .on("mouseover", (event, d: GraphNode) => {
                hoveredNodeId = d.id;
                nodeGroup.style("opacity", (n: GraphNode) => getOpacity(n));
                link.style("opacity", (l: any) => {
                    if (l.source.id === d.id || l.target.id === d.id) return 0.6;
                    return 0.05;
                });
            })
            .on("mouseout", () => {
                hoveredNodeId = null;
                if (searchTerm) {
                    const t = searchTerm.toLowerCase();
                    const isMatch = (n: GraphNode) =>
                        (n.tags && n.tags.some((tag: string) => tag.toLowerCase().includes(t))) ||
                        (n.type === 'group' && n.name.toLowerCase().includes(t)) ||
                        (n.type === 'person' && (
                            n.name.toLowerCase().includes(t) || n.company?.toLowerCase().includes(t)
                        ));
                    nodeGroup.style("opacity", (n: GraphNode) => isMatch(n) ? 1 : 0.1);
                    link.style("opacity", 0.05);
                } else {
                    nodeGroup.style("opacity", 1);
                    link.style("opacity", 0.6);
                }
            })
            .style("cursor", "pointer");

        nodeSelectionRef.current = nodeGroup;

        // Labels
        const labels = nodeGroup.append("text")
            .attr("dx", (d: GraphNode) => d.type === 'person' ? 20 : 28)
            .attr("dy", 5)
            .text((d: GraphNode) => d.name)
            .attr("font-family", "system-ui, sans-serif")
            .attr("font-size", (d: GraphNode) => d.type === 'person' ? "12px" : "13px")
            .attr("font-weight", (d: GraphNode) => d.type === 'person' ? "600" : "700")
            .attr("fill", "#1e293b")
            .style("pointer-events", "none");

        labels.each(function (d: GraphNode) {
            const bbox = this.getComputedTextLength();
            d.textWidth = bbox;
            d.width = bbox + (d.type === 'person' ? 40 : 50);
        });

        nodeGroup.insert("rect", "text")
            .attr("rx", 12).attr("ry", 12)
            .attr("x", (d: GraphNode) => d.type === 'person' ? 10 : 15)
            .attr("y", -12)
            .attr("width", (d: GraphNode) => (d.textWidth || 50) + 20)
            .attr("height", 24)
            .attr("fill", "white")
            .attr("stroke", "#e2e8f0")
            .attr("stroke-width", 1)
            .style("pointer-events", "none");

        nodeGroup.append("circle")
            .attr("r", (d: GraphNode) => d.type !== 'person' ? 22 : 14)
            .attr("fill", (d: GraphNode) => {
                if (d.type !== 'person') return colorScale(d.name);
                return d.industry ? colorScale(d.industry) : "#64748b";
            })
            .attr("stroke", "#ffffff").attr("stroke-width", 2.5)
            .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))");

        nodeGroup.filter((d: GraphNode) => d.type !== 'person')
            .append("text")
            .text((d: GraphNode) => d.name.substring(0, 1).toUpperCase())
            .attr("text-anchor", "middle").attr("dy", "0.35em")
            .attr("fill", "#fff").attr("font-size", "12px").attr("font-weight", "bold")
            .style("pointer-events", "none");

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);
            nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

    }, [contacts, dimension, customMappings]);

    // --- Search & Physics Update ---
    useEffect(() => {
        const simulation = simulationRef.current;
        if (!simulation || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            const isMatch = (d: GraphNode) => {
                if (d.tags && d.tags.some(tag => tag.toLowerCase().includes(t))) return true;
                if (d.type === 'group' && d.name.toLowerCase().includes(t)) return true;
                if (d.type === 'person') {
                    return d.name.toLowerCase().includes(t) ||
                        d.company?.toLowerCase().includes(t) ||
                        d.role?.toLowerCase().includes(t) ||
                        d.industry?.toLowerCase().includes(t);
                }
                return false;
            };

            simulation.force("searchX", d3.forceX(width / 2).strength((d: any) => isMatch(d) ? 1.0 : 0));
            simulation.force("searchY", d3.forceY(height / 2).strength((d: any) => isMatch(d) ? 1.0 : 0));
            simulation.alpha(1).restart();
        } else {
            simulation.force("searchX", null);
            simulation.force("searchY", null);
            simulation.alpha(0.3).restart();

            if (searchTerm === '') {
                resetZoom();
            }
        }
    }, [searchTerm]);

    // --- Cluster Navigation Logic ---
    useEffect(() => {
        if (!searchTerm) {
            setMatchClusters([]);
            // Only reset index if we are clearing search. If re-mounting with existing search, keep it.
            // But if user changed search term, reset.
            if (prevSearchTerm.current !== searchTerm) {
                updateGraphState({ currentClusterIndex: 0 });
            }
            prevSearchTerm.current = searchTerm;
            return;
        }

        prevSearchTerm.current = searchTerm;

        const t = searchTerm.toLowerCase();
        const isMatch = (d: GraphNode) => {
            if (d.tags && d.tags.some(tag => tag.toLowerCase().includes(t))) return true;
            if (d.type === 'group' && d.name.toLowerCase().includes(t)) return true;
            if (d.type === 'person') {
                return d.name.toLowerCase().includes(t) ||
                    d.role?.toLowerCase().includes(t) ||
                    d.company?.toLowerCase().includes(t) ||
                    d.industry?.toLowerCase().includes(t);
            }
            return false;
        };

        const matches = nodes.filter(isMatch);
        if (matches.length === 0) {
            setMatchClusters([]);
            return;
        }

        setMatchClusters([matches]);
    }, [searchTerm, nodes]);

    // Keyboard Nav
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!searchTerm || matchClusters.length <= 1) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    updateGraphState({ currentClusterIndex: (currentClusterIndex - 1 + matchClusters.length) % matchClusters.length });
                } else {
                    updateGraphState({ currentClusterIndex: (currentClusterIndex + 1) % matchClusters.length });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchTerm, matchClusters, currentClusterIndex]);

    // Visual Styling & Zoom Trigger
    useEffect(() => {
        const nodeGroup = nodeSelectionRef.current;
        const link = linkSelectionRef.current;
        if (!nodeGroup || !link) return;

        let zoomTimer: ReturnType<typeof setTimeout>;

        if (searchTerm && matchClusters.length > 0) {
            const t = searchTerm.toLowerCase();
            const isMatch = (d: GraphNode) => {
                if (d.tags && d.tags.some(tag => tag.toLowerCase().includes(t))) return true;
                if (d.type === 'group' && d.name.toLowerCase().includes(t)) return true;
                if (d.type === 'person') {
                    return d.name.toLowerCase().includes(t) || d.company?.toLowerCase().includes(t) || d.role?.toLowerCase().includes(t) || (d.tags && d.tags.some(tag => tag.toLowerCase().includes(t)));
                }
                return false;
            };

            nodeGroup.transition().duration(300)
                .style("opacity", (d: GraphNode) => isMatch(d) ? 1 : 0.1);

            link.transition().duration(300).style("opacity", 0.05);

            const targetNodes = matchClusters[currentClusterIndex];
            if (targetNodes && targetNodes.length > 0 && svgRef.current && zoomBehaviorRef.current && containerRef.current) {
                zoomTimer = setTimeout(() => {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    targetNodes.forEach(d => {
                        if (typeof d.x === 'number' && typeof d.y === 'number') {
                            minX = Math.min(minX, d.x); minY = Math.min(minY, d.y);
                            maxX = Math.max(maxX, d.x); maxY = Math.max(maxY, d.y);
                        }
                    });

                    if (minX !== Infinity && containerRef.current) {
                        const width = containerRef.current.clientWidth;
                        const height = containerRef.current.clientHeight;
                        let dx = maxX - minX;
                        let dy = maxY - minY;
                        if (dx === 0) dx = 100; if (dy === 0) dy = 100;

                        const x = (minX + maxX) / 2;
                        const y = (minY + maxY) / 2;
                        let scale = 0.8 / Math.max(dx / width, dy / height);
                        scale = Math.max(0.5, Math.min(2.0, scale));

                        const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-x, -y);
                        d3.select(svgRef.current).transition().duration(750)
                            .call(zoomBehaviorRef.current!.transform, transform);
                    }
                }, 500);
            }

        } else if (!searchTerm) {
            nodeGroup.transition().duration(300).style("opacity", 1);
            link.transition().duration(300).style("opacity", 0.6);
        }

        return () => {
            if (zoomTimer) clearTimeout(zoomTimer);
        };
    }, [searchTerm, matchClusters, currentClusterIndex]);

    const handleZoom = (factor: number) => {
        if (svgRef.current && zoomBehaviorRef.current) {
            d3.select(svgRef.current).transition().call(zoomBehaviorRef.current.scaleBy, factor);
        }
    };

    return (
        <div className="relative w-full h-full bg-slate-50 overflow-hidden dot-pattern" ref={containerRef}>
            {isAnalyzing && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-30 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center">
                        <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                        <h3 className="text-lg font-bold text-slate-800">Analyzing Network...</h3>
                        <p className="text-sm text-slate-500">Grouping by "{dimension}"</p>
                    </div>
                </div>
            )}

            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
                <div className="bg-white/95 backdrop-blur shadow-xl rounded-2xl flex flex-col border border-slate-200 ring-1 ring-slate-200/50">
                    <div className="flex items-center p-1.5">
                        <Search className="ml-3 text-slate-400 shrink-0" size={18} />
                        <input
                            type="text"
                            placeholder="Search network..."
                            className="bg-transparent border-none focus:outline-none text-sm w-full px-3 py-2 text-slate-700 placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => updateGraphState({ searchTerm: e.target.value })}
                        />
                        {searchTerm && (
                            <button onClick={handleClearSearch} className="mr-2 text-slate-400 hover:text-slate-600 p-1">
                                <X size={14} />
                            </button>
                        )}

                        <div className="h-6 w-px bg-slate-200 mx-1 shrink-0"></div>

                        <div className="relative shrink-0 flex items-center gap-1" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${isDropdownOpen ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                                <SlidersHorizontal size={14} />
                                <span className="max-w-[150px] truncate">
                                    {dimension === 'company' ? "AI Dimension Search" : <span className="capitalize">{dimension}</span>}
                                </span>
                                <ChevronDown size={12} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {dimension !== 'company' && (
                                <button
                                    onClick={handleResetDimension}
                                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Reset to Company View"
                                >
                                    <X size={14} />
                                </button>
                            )}

                            {isDropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white shadow-2xl rounded-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 p-3 z-50">
                                    <div className="mb-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 block mb-2">
                                            AI Dimension / Tag
                                        </label>
                                        <form onSubmit={handleCustomDimensionSubmit} className="flex gap-2">
                                            <div className="relative w-full">
                                                <Sparkles className="absolute left-2.5 top-2.5 text-indigo-400" size={12} />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    className="w-full pl-7 pr-2 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900 placeholder:text-indigo-400"
                                                    placeholder="Type e.g. Female, Investor, Seniority..."
                                                    value={customDimensionInput}
                                                    onChange={e => updateGraphState({ customDimensionInput: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleCustomDimensionSubmit();
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </form>
                                        <p className="text-[10px] text-slate-400 mt-2 px-1 leading-relaxed">
                                            Type any concept. If a tag matches, we'll use it. If not, Gemini will infer it for your contacts automatically.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {searchTerm && matchClusters.length > 1 && (
                        <div className="px-3 pb-2 pt-0 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
                            <span className="mt-1">
                                Viewing Cluster {currentClusterIndex + 1} of {matchClusters.length}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-slate-100 px-1.5 rounded text-[10px] border border-slate-200 font-mono">Enter</span>
                                <ArrowRight size={10} />
                                <span>Next</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
                <button onClick={resetZoom} className="bg-white p-2.5 rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-transform active:scale-95">
                    <RefreshCw size={20} />
                </button>
                <div className="flex flex-col bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <button onClick={() => handleZoom(1.2)} className="p-2.5 hover:bg-slate-50 text-slate-600 border-b border-slate-100 transition-colors">
                        <ZoomIn size={20} />
                    </button>
                    <button onClick={() => handleZoom(0.8)} className="p-2.5 hover:bg-slate-50 text-slate-600 transition-colors">
                        <ZoomOut size={20} />
                    </button>
                </div>
            </div>

            <svg ref={svgRef} className="w-full h-full cursor-move active:cursor-grabbing" />
        </div>
    );
};
