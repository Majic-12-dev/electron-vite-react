import React, { useState, useMemo } from 'react';
import { Search, Copy, Check, Filter } from 'lucide-react';
import { EXCEL_FORMULAS, ExcelFormula } from '@/data/excelFormulasFull';
import { BaseToolLayout } from '@/components/layout/BaseToolLayout';

export const ExcelFormulaTool: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [copiedName, setCopiedName] = useState<string | null>(null);

    const categories = ['All', ...Array.from(new Set(EXCEL_FORMULAS.map(f => f.category)))];

    const filteredFormulas = useMemo(() => {
        return EXCEL_FORMULAS.filter(formula => {
            const matchesSearch = 
                formula.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                formula.description.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || formula.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchTerm, selectedCategory]);

    const copyToClipboard = (text: string, name: string) => {
        navigator.clipboard.writeText(text);
        setCopiedName(name);
        setTimeout(() => setCopiedName(null), 2000);
    };

    return (
        <BaseToolLayout 
            title="Excel Formula Library"
            description="Browse, search, and copy advanced Excel formulas for data transformation."
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search formulas by name or description..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-slate-400" />
                        <select
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid gap-4">
                    {filteredFormulas.map((formula) => (
                        <div key={formula.name} className="bg-slate-800 border border-slate-700 p-4 rounded-lg hover:border-slate-600 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-lg font-semibold text-blue-400">{formula.name}</h3>
                                    <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-slate-300">{formula.category} | {formula.difficulty}</span>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(formula.example, formula.name)}
                                    className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
                                    title="Copy Example"
                                >
                                    {copiedName === formula.name ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                </button>
                            </div>
                            <p className="text-sm text-slate-300 mb-3">{formula.description}</p>
                            <div className="bg-slate-900 p-3 rounded font-mono text-sm text-amber-400 overflow-x-auto">
                                <code>{formula.syntax}</code>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Example: <code className="text-slate-400">{formula.example}</code></p>
                        </div>
                    ))}
                    {filteredFormulas.length === 0 && (
                        <div className="text-center py-12 text-slate-500">No formulas found matching your criteria.</div>
                    )}
                </div>
            </div>
        </BaseToolLayout>
    );
};