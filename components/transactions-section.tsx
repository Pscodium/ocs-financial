"use client"

import { useEffect, useMemo, useState } from "react"
import type { Transaction } from "@/lib/types"
import { createId, formatCurrency } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Zap, Plus, Trash2, Tag } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransactionsSectionProps {
  monthKey: string
  transactions: Transaction[]
  onAdd: (transaction: Transaction) => void | Promise<void>
  onUpdate: (transaction: Transaction) => void | Promise<void>
  onRemove: (transactionId: string) => void | Promise<void>
}

function getDefaultDate(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number)
  const now = new Date()
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    return now.toISOString().slice(0, 10)
  }
  return `${monthKey}-01`
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

interface TagAutocompleteProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  onEnter?: () => void
}

function TagAutocomplete({ value, onChange, suggestions, onEnter }: TagAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase()
    const list = query
      ? suggestions.filter((s) => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      : suggestions
    return list.slice(0, 6)
  }, [value, suggestions])

  const showSuggestions = isOpen && filtered.length > 0

  return (
    <div className="relative">
      <Input
        id="transaction-tag"
        placeholder="Ex: lazer, comida..."
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.()
          if (e.key === "Escape") setIsOpen(false)
        }}
        autoComplete="off"
        className={cn(showSuggestions && "rounded-b-none border-b-transparent")}
      />
      {showSuggestions && (
        <div className="absolute left-0 right-0 top-full z-50 overflow-hidden rounded-b-md border border-t-0 bg-popover shadow-md">
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(suggestion)
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-popover-foreground transition-colors hover:bg-amber-500/10"
            >
              <Tag className="h-3 w-3 shrink-0 text-amber-500/70" />
              <span className="truncate">{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface TransactionDialogProps {
  monthKey: string
  open: boolean
  onOpenChange: (open: boolean) => void
  tagSuggestions: string[]
  editingTransaction: Transaction | null
  onSave: (transaction: Transaction) => Promise<void> | void
}

function TransactionDialog({ monthKey, open, onOpenChange, tagSuggestions, editingTransaction, onSave }: TransactionDialogProps) {
  const isEditing = Boolean(editingTransaction)
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(() => getDefaultDate(monthKey))
  const [tag, setTag] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  function resetForm() {
    setDescription("")
    setAmount("")
    setDate(getDefaultDate(monthKey))
    setTag("")
  }

  useEffect(() => {
    if (!open) return
    if (editingTransaction) {
      setDescription(editingTransaction.description)
      setAmount(String(editingTransaction.amount).replace(".", ","))
      setDate(editingTransaction.date)
      setTag(editingTransaction.tag ?? "")
    } else {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTransaction])

  async function handleSave() {
    const parsedAmount = Number(amount.replace(",", "."))
    if (!description.trim() || !parsedAmount || parsedAmount <= 0 || !date) return

    setIsSaving(true)
    try {
      await onSave({
        id: editingTransaction?.id ?? createId(),
        description: description.trim(),
        amount: parsedAmount,
        date,
        tag: tag.trim() || undefined,
      })
      resetForm()
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {isEditing ? "Editar transação" : "Registrar transação"}
          </DialogTitle>
          <DialogDescription>Gasto pontual do dia, fora das contas mensais. Registro rápido.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="transaction-description">Descrição</Label>
            <Input
              id="transaction-description"
              placeholder="Ex: Lanche, Uber, Farmácia..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="transaction-amount">Valor</Label>
              <Input
                id="transaction-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transaction-date">Data</Label>
              <Input
                id="transaction-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transaction-tag">Tag (opcional)</Label>
            <TagAutocomplete value={tag} onChange={setTag} suggestions={tagSuggestions} onEnter={handleSave} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !description.trim() || !amount}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TransactionsSection({ monthKey, transactions, onAdd, onUpdate, onRemove }: TransactionsSectionProps) {
  const [open, setOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  function openForCreate() {
    setEditingTransaction(null)
    setOpen(true)
  }

  function openForEdit(transaction: Transaction) {
    setEditingTransaction(transaction)
    setOpen(true)
  }

  function handleSave(transaction: Transaction) {
    return editingTransaction ? onUpdate(transaction) : onAdd(transaction)
  }

  const tagSuggestions = useMemo(() => {
    const tags = new Set<string>()
    for (const t of transactions) {
      if (t.tag) tags.add(t.tag)
    }
    return Array.from(tags)
  }, [transactions])

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  )

  const total = useMemo(() => transactions.reduce((sum, t) => sum + t.amount, 0), [transactions])

  if (transactions.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={openForCreate}
          className="w-full rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center gap-2"
        >
          <Zap className="h-3.5 w-3.5" />
          Registrar transação avulsa
        </button>
        <TransactionDialog
          monthKey={monthKey}
          open={open}
          onOpenChange={setOpen}
          tagSuggestions={tagSuggestions}
          editingTransaction={editingTransaction}
          onSave={handleSave}
        />
      </>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-transparent">
      <div className="flex items-center justify-between border-b border-amber-500/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
            <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Transações</p>
            <p className="truncate text-xs text-muted-foreground">
              {transactions.length} avulsa{transactions.length > 1 ? "s" : ""} · {formatCurrency(total)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 text-amber-700 hover:text-amber-800 dark:text-amber-400"
          onClick={openForCreate}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Novo
        </Button>
      </div>

      <div className="max-h-64 divide-y divide-amber-500/10 overflow-y-auto">
        {sortedTransactions.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openForEdit(t)}
            className="group flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-amber-500/5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{t.description}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{formatShortDate(t.date)}</span>
                {t.tag && (
                  <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                    {t.tag}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-sm text-amber-700 dark:text-amber-400">{formatCurrency(t.amount)}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(t.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                    e.preventDefault()
                    onRemove(t.id)
                  }
                }}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Remover transação"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>

      <TransactionDialog
        monthKey={monthKey}
        open={open}
        onOpenChange={setOpen}
        tagSuggestions={tagSuggestions}
        editingTransaction={editingTransaction}
        onSave={handleSave}
      />
    </div>
  )
}
