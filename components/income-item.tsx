"use client"

import { useState } from "react"
import type { Bill } from "@/lib/types"
import { formatCurrency } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Check, X, Banknote } from "lucide-react"

interface IncomeItemProps {
  entry: Bill
  categoryId: string
  onUpdate: (categoryId: string, billId: string, updates: Partial<Omit<Bill, "id" | "categoryId">>) => void
  onRemove: (categoryId: string, billId: string) => void
}

export function IncomeItem({ entry, categoryId, onUpdate, onRemove }: IncomeItemProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(entry.name)
  const [editAmount, setEditAmount] = useState(String(entry.amount))
  const [editNote, setEditNote] = useState(entry.note || "")

  const handleSave = () => {
    const amount = Number.parseFloat(editAmount.replace(",", "."))
    if (!editName.trim() || Number.isNaN(amount) || amount < 0) return
    onUpdate(categoryId, entry.id, {
      name: editName.trim(),
      amount,
      note: editNote.trim() || undefined,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setEditName(entry.name)
    setEditAmount(String(entry.amount))
    setEditNote(entry.note || "")
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Nome"
            className="flex-1 bg-card text-foreground"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") handleCancel()
            }}
          />
          <Input
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            placeholder="Valor"
            className="w-full bg-card text-foreground sm:w-32"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") handleCancel()
            }}
          />
        </div>
        <Input
          value={editNote}
          onChange={(e) => setEditNote(e.target.value)}
          placeholder="Observacao (opcional)"
          className="bg-card text-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") handleCancel()
          }}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="mr-1 h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Check className="mr-1 h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Banknote className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{entry.name}</p>
        {entry.note && <p className="mt-0.5 text-xs text-muted-foreground">{entry.note}</p>}
      </div>
      <span className="shrink-0 font-mono text-sm font-semibold text-primary">
        {formatCurrency(entry.amount)}
      </span>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
          aria-label={`Editar ${entry.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(categoryId, entry.id)}
          aria-label={`Remover ${entry.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
