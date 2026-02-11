"use client"

import { useState } from "react"
import type { Bill } from "@/lib/types"
import { formatCurrency } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface BillItemProps {
  bill: Bill
  categoryId: string
  onToggle: (categoryId: string, billId: string) => void
  onUpdate: (categoryId: string, billId: string, updates: Partial<Omit<Bill, "id" | "categoryId">>) => void
  onRemove: (categoryId: string, billId: string) => void
}

export function BillItem({ bill, categoryId, onToggle, onUpdate, onRemove }: BillItemProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(bill.name)
  const [editAmount, setEditAmount] = useState(String(bill.amount))
  const [editNote, setEditNote] = useState(bill.note || "")

  const handleSave = () => {
    const amount = Number.parseFloat(editAmount.replace(",", "."))
    if (!editName.trim() || Number.isNaN(amount) || amount < 0) return
    onUpdate(categoryId, bill.id, {
      name: editName.trim(),
      amount,
      note: editNote.trim() || undefined,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setEditName(bill.name)
    setEditAmount(String(bill.amount))
    setEditNote(bill.note || "")
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Nome da conta"
            className="flex-1 bg-card text-foreground"
          />
          <Input
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            placeholder="Valor"
            className="w-full bg-card text-foreground sm:w-32"
          />
        </div>
        <Input
          value={editNote}
          onChange={(e) => setEditNote(e.target.value)}
          placeholder="Observacao (opcional)"
          className="bg-card text-foreground"
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
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50",
        bill.paid && "opacity-75",
      )}
    >
      <Checkbox
        checked={bill.paid}
        onCheckedChange={() => onToggle(categoryId, bill.id)}
        className="h-5 w-5 border-2 data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium text-foreground transition-all",
            bill.paid && "text-muted-foreground line-through",
          )}
        >
          {bill.name}
        </p>
        {bill.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">{bill.note}</p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 font-mono text-sm font-semibold",
          bill.paid ? "text-success" : "text-foreground",
        )}
      >
        {formatCurrency(bill.amount)}
      </span>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
          aria-label={`Editar ${bill.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(categoryId, bill.id)}
          aria-label={`Remover ${bill.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
