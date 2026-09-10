import { FC, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BtcUtxo, BtcPriceData } from '../types';
import { Layers, Clock, ShieldCheck, Filter, Info, ExternalLink, Zap, Flame } from 'lucide-react';

interface UtxoD3BlockGraphProps {
  utxos: BtcUtxo[];
  priceData: BtcPriceData | null;
  currentBlockHeight?: number;
}

type GraphMode = 'treemap' | 'bubbles' | 'stack';

export const UtxoD3BlockGraph: FC<UtxoD3BlockGraphProps> = ({
  utxos,
  priceData,
  currentBlockHeight = 880000,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [mode, setMode] = useState<GraphMode>('treemap');
  const [selectedUtxo, setSelectedUtxo] = useState<BtcUtxo | null>(null);
  const [hoveredUtxo, setHoveredUtxo] = useState<BtcUtxo | null>(null);
  const [sortBy, setSortBy] = useState<'size' | 'age'>('size');

  const btcPrice = priceData?.priceUsd || 95000;

  // Calculate age / confirmations for color coding
  const getUtxoAgeColor = (utxo: BtcUtxo) => {
    if (!utxo.status.confirmed) {
      return {
        bg: '#f59e0b', // Amber for Mempool unconfirmed
        label: 'Mempool Unconfirmed',
        badge: 'Unconfirmed',
        text: '#78350f',
      };
    }

    const height = utxo.status.block_height || currentBlockHeight;
    const depth = Math.max(1, currentBlockHeight - height);

    if (depth < 1000) {
      return {
        bg: '#10b981', // Mint / Emerald (Fresh UTXO)
        label: '< 1,000 Blocks (Fresh)',
        badge: 'Fresh (<1k Blocks)',
        text: '#064e3b',
      };
    } else if (depth < 10000) {
      return {
        bg: '#0284c7', // Sky Blue (Medium Age)
        label: '1k - 10k Blocks (Medium)',
        badge: 'Medium (1k-10k)',
        text: '#0c4a6e',
      };
    } else if (depth < 50000) {
      return {
        bg: '#6366f1', // Indigo (Seasoned HODL)
        label: '10k - 50k Blocks (Seasoned)',
        badge: 'Seasoned (10k-50k)',
        text: '#312e81',
      };
    } else {
      return {
        bg: '#e11d48', // Ruby / Crimson (Vintage / Ancient)
        label: '> 50,000 Blocks (Vintage)',
        badge: 'Vintage (>50k)',
        text: '#881337',
      };
    }
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || utxos.length === 0) return;

    const width = containerRef.current.clientWidth || 700;
    const height = mode === 'stack' ? 180 : 360;

    // Clear previous D3 elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    if (mode === 'treemap') {
      // D3 Treemap Layout
      const sortedUtxos = [...utxos].sort((a, b) =>
        sortBy === 'size' ? b.value - a.value : (a.status.block_height || 0) - (b.status.block_height || 0)
      );

      const rootData = {
        name: 'UTXOs',
        children: sortedUtxos.map((u) => ({
          name: `${u.txid.slice(0, 6)}:${u.vout}`,
          value: u.value,
          utxo: u,
        })),
      };

      const hierarchyNode = d3
        .hierarchy(rootData)
        .sum((d: any) => d.value)
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

      const treemapLayout = d3.treemap().size([width, height]).padding(3).round(true);

      treemapLayout(hierarchyNode as any);

      const leaves = hierarchyNode.leaves();

      const g = svg.append('g');

      const leafGroups = g
        .selectAll('g')
        .data(leaves)
        .enter()
        .append('g')
        .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

      leafGroups
        .append('rect')
        .attr('width', (d: any) => Math.max(0, d.x1 - d.x0))
        .attr('height', (d: any) => Math.max(0, d.y1 - d.y0))
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', (d: any) => getUtxoAgeColor(d.data.utxo).bg)
        .attr('fill-opacity', 0.88)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .style('transition', 'all 0.2s ease')
        .on('mouseover', function (event, d: any) {
          d3.select(this).attr('fill-opacity', 1).attr('stroke', '#18181b').attr('stroke-width', 3);
          setHoveredUtxo(d.data.utxo);
        })
        .on('mouseout', function () {
          d3.select(this).attr('fill-opacity', 0.88).attr('stroke', '#ffffff').attr('stroke-width', 2);
          setHoveredUtxo(null);
        })
        .on('click', (_event, d: any) => {
          setSelectedUtxo(d.data.utxo);
        });

      // Add text label inside block if space allows
      leafGroups
        .append('text')
        .attr('x', 6)
        .attr('y', 18)
        .text((d: any) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          if (w < 50 || h < 25) return '';
          return `${(d.data.utxo.value / 100000000).toFixed(4)} BTC`;
        })
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'monospace')
        .attr('fill', '#ffffff')
        .style('pointer-events', 'none');

      leafGroups
        .append('text')
        .attr('x', 6)
        .attr('y', 32)
        .text((d: any) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          if (w < 70 || h < 45) return '';
          return `:#${d.data.utxo.vout}`;
        })
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('fill', 'rgba(255,255,255,0.85)')
        .style('pointer-events', 'none');
    } else if (mode === 'bubbles') {
      // D3 Bubble Pack Layout
      const packData = {
        name: 'UTXOs',
        children: utxos.map((u) => ({
          name: u.txid.slice(0, 6),
          value: u.value,
          utxo: u,
        })),
      };

      const packRoot = d3
        .hierarchy(packData)
        .sum((d: any) => d.value)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      const packLayout = d3.pack().size([width, height]).padding(6);

      packLayout(packRoot as any);

      const nodes = packRoot.leaves();

      const g = svg.append('g');

      const circleGroups = g
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

      circleGroups
        .append('circle')
        .attr('r', (d: any) => Math.max(4, d.r))
        .attr('fill', (d: any) => getUtxoAgeColor(d.data.utxo).bg)
        .attr('fill-opacity', 0.85)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function (_event, d: any) {
          d3.select(this).attr('fill-opacity', 1).attr('stroke', '#18181b').attr('stroke-width', 3);
          setHoveredUtxo(d.data.utxo);
        })
        .on('mouseout', function () {
          d3.select(this).attr('fill-opacity', 0.85).attr('stroke', '#ffffff').attr('stroke-width', 2);
          setHoveredUtxo(null);
        })
        .on('click', (_event, d: any) => {
          setSelectedUtxo(d.data.utxo);
        });

      circleGroups
        .append('text')
        .text((d: any) => (d.r > 20 ? `${(d.data.utxo.value / 100000000).toFixed(3)} BTC` : ''))
        .attr('text-anchor', 'middle')
        .attr('dy', '0.3em')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .style('pointer-events', 'none');
    } else if (mode === 'stack') {
      // D3 Horizontal Stack Bar
      const totalSats = d3.sum(utxos, (u: BtcUtxo) => u.value) || 1;
      let currentX = 0;

      const g = svg.append('g').attr('transform', 'translate(10, 40)');
      const barHeight = 80;
      const usableWidth = width - 20;

      utxos.forEach((utxo, i) => {
        const segWidth = (utxo.value / totalSats) * usableWidth;
        const xPos = currentX;
        currentX += segWidth;

        const ageInfo = getUtxoAgeColor(utxo);

        const rect = g
          .append('rect')
          .attr('x', xPos)
          .attr('y', 0)
          .attr('width', Math.max(2, segWidth - 1))
          .attr('height', barHeight)
          .attr('rx', 4)
          .attr('fill', ageInfo.bg)
          .attr('fill-opacity', 0.9)
          .style('cursor', 'pointer')
          .on('mouseover', function () {
            d3.select(this).attr('fill-opacity', 1);
            setHoveredUtxo(utxo);
          })
          .on('mouseout', function () {
            d3.select(this).attr('fill-opacity', 0.9);
            setHoveredUtxo(null);
          })
          .on('click', () => {
            setSelectedUtxo(utxo);
          });

        if (segWidth > 45) {
          g.append('text')
            .attr('x', xPos + 6)
            .attr('y', 24)
            .text(`${((utxo.value / totalSats) * 100).toFixed(1)}%`)
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .attr('fill', '#ffffff')
            .style('pointer-events', 'none');

          g.append('text')
            .attr('x', xPos + 6)
            .attr('y', 42)
            .text(`${(utxo.value / 100000000).toFixed(4)} BTC`)
            .attr('font-size', '10px')
            .attr('fill', 'rgba(255,255,255,0.9)')
            .style('pointer-events', 'none');
        }
      });
    }
  }, [utxos, mode, sortBy, currentBlockHeight]);

  if (utxos.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400">
        No UTXOs available to visualize.
      </div>
    );
  }

  const activeDisplayUtxo = hoveredUtxo || selectedUtxo || utxos[0];
  const activeAgeInfo = activeDisplayUtxo ? getUtxoAgeColor(activeDisplayUtxo) : null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      {/* Graph Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" />
            <h3 className="font-serif text-base font-bold text-zinc-900">
              D3 UTXO Age & Size Visual Matrix
            </h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
              D3.js Live Graph
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Blocks represent unspent outputs sized proportional to satoshi value & color-coded by age depth
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50 text-xs">
            <button
              onClick={() => setMode('treemap')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                mode === 'treemap' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Treemap Blocks
            </button>
            <button
              onClick={() => setMode('bubbles')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                mode === 'bubbles' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Age Bubbles
            </button>
            <button
              onClick={() => setMode('stack')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                mode === 'stack' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Stack Bar
            </button>
          </div>
        </div>
      </div>

      {/* Age Color Band Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
        <span className="font-semibold text-zinc-700 flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-amber-500" /> Age Bands:
        </span>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#f59e0b] inline-block" />
          <span className="text-zinc-600">Mempool (Unconfirmed)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#10b981] inline-block" />
          <span className="text-zinc-600">Fresh (&lt;1k blocks)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#0284c7] inline-block" />
          <span className="text-zinc-600">Medium (1k-10k)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#6366f1] inline-block" />
          <span className="text-zinc-600">Seasoned (10k-50k)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#e11d48] inline-block" />
          <span className="text-zinc-600">Vintage (&gt;50k)</span>
        </div>
      </div>

      {/* D3 Canvas Container */}
      <div ref={containerRef} className="relative w-full rounded-xl bg-zinc-950 p-2 shadow-inner overflow-hidden">
        <svg ref={svgRef} className="w-full h-auto block" />
      </div>

      {/* Selected/Hovered UTXO Inspection Panel */}
      {activeDisplayUtxo && activeAgeInfo && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-zinc-900 truncate max-w-xs">
                  {activeDisplayUtxo.txid}
                </span>
                <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-800">
                  :{activeDisplayUtxo.vout}
                </span>
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: activeAgeInfo.bg }}
                >
                  {activeAgeInfo.badge}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600">
                <span>
                  Value: <strong className="font-mono text-zinc-900">{activeDisplayUtxo.value.toLocaleString()} Sats</strong> ({(activeDisplayUtxo.value / 100000000).toFixed(8)} BTC)
                </span>
                <span>
                  USD: <strong className="text-emerald-700 font-semibold">${((activeDisplayUtxo.value / 100000000) * btcPrice).toFixed(2)}</strong>
                </span>
                <span>
                  Block Height: <strong className="font-mono text-zinc-900">{activeDisplayUtxo.status.block_height ? activeDisplayUtxo.status.block_height.toLocaleString() : 'Mempool'}</strong>
                </span>
              </div>
            </div>

            <a
              href={`https://mempool.space/tx/${activeDisplayUtxo.txid}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 shrink-0 self-start sm:self-center"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Inspect on Mempool</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
