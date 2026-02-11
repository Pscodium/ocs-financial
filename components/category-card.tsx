"use client"

import { useState } from "react"
import type { Bill, Category } from "@/lib/types"
import { formatCurrency } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BillItem } from "@/components/bill-item"
import { IncomeItem } from "@/components/income-item"
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  SplitSquareHorizontal,
  Wallet,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface CategoryCardProps {
  category: Category
  totalAmount: number
  paidAmount: number
  onToggleBill: (categoryId: string, billId: string) => void
  onUpdateBill: (
    categoryId: string,
    billId: string,
    updates: Partial<Omit<Bill, "id" | "categoryId">>,
  ) => void
  onRemoveBill: (categoryId: string, billId: string) => void
  onAddBill: (categoryId: string, bill: Omit<Bill, "id" | "categoryId">) => void
  onUpdateCategory: (categoryId: string, name: string, splitBy?: number) => void
  onRemoveCategory: (categoryId: string) => void
}

export function CategoryCard({
  category,
  totalAmount,
  paidAmount,
  onToggleBill,
  onUpdateBill,
  onRemoveBill,
  onAddBill,
  onUpdateCategory,
  onRemoveCategory,
}: CategoryCardProps) {
  const [showAddBill, setShowAddBill] = useState(false)
  const [newBillName, setNewBillName] = useState("")
  const [newBillAmount, setNewBillAmount] = useState("")
  const [newBillNote, setNewBillNote] = useState("")

  const [showEditCategory, setShowEditCategory] = useState(false)
  const [editCatName, setEditCatName] = useState(category.name)
  const [editCatSplit, setEditCatSplit] = useState(category.splitBy ? String(category.splitBy) : "")

  const isIncome = category.type === "income"
  const paidCount = category.bills.filter((b) => b.paid).length
  const pendingAmount = totalAmount - paidAmount

  const handleAddBill = () => {
    const amount = Number.parseFloat(newBillAmount.replace(",", "."))
    if (!newBillName.trim() || Number.isNaN(amount) || amount < 0) return
    onAddBill(category.id, {
      name: newBillName.trim(),
      amount,
      paid: false,
      note: newBillNote.trim() || undefined,
    })
    setNewBillName("")
    setNewBillAmount("")
    setNewBillNote("")
    setShowAddBill(false)
  }

  const handleEditCategory = () => {
    if (!editCatName.trim()) return
    const splitNum = editCatSplit ? Number.parseInt(editCatSplit, 10) : undefined
    onUpdateCategory(category.id, editCatName.trim(), splitNum && splitNum > 1 ? splitNum : undefined)
    setShowEditCategory(false)
  }

  const addLabel = isIncome ? "Adicionar saldo" : "Adicionar conta"
  const emptyLabel = isIncome ? "Nenhum saldo adicionado" : "Nenhuma conta adicionada"

  return (
    <>
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isIncome && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <h3 className="truncate text-base font-semibold text-foreground">{category.name}</h3>
              {!isIncome && category.splitBy && category.splitBy > 1 && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  <SplitSquareHorizontal className="h-3 w-3" />
                  {`\u00F7${category.splitBy}`}
                </span>
              )}
              {isIncome && (
                <span className="inline-flex shrink-0 items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Saldos
                </span>
              )}
            </div>
            {!isIncome && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {paidCount} de {category.bills.length} pagas
              </p>
            )}
            {isIncome && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {category.bills.length} {category.bills.length === 1 ? "entrada" : "entradas"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-foreground">
                {formatCurrency(totalAmount)}
              </p>
              {!isIncome && pendingAmount > 0 && (
                <p className="font-mono text-xs text-warning">{formatCurrency(pendingAmount)} pendente</p>
              )}
              {!isIncome && category.splitBy && category.splitBy > 1 && (
                <p className="font-mono text-xs text-muted-foreground">
                  Sua parte: {formatCurrency(totalAmount / category.splitBy)}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label="Opcoes da categoria"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditCatName(category.name)
                    setEditCatSplit(category.splitBy ? String(category.splitBy) : "")
                    setShowEditCategory(true)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar categoria
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onRemoveCategory(category.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover categoria
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 pt-0">
          {category.bills.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
          )}

          {isIncome
            ? category.bills.map((entry) => (
                <IncomeItem
                  key={entry.id}
                  entry={entry}
                  categoryId={category.id}
                  onUpdate={onUpdateBill}
                  onRemove={onRemoveBill}
                />
              ))
            : category.bills.map((bill) => (
                <BillItem
                  key={bill.id}
                  bill={bill}
                  categoryId={category.id}
                  onToggle={onToggleBill}
                  onUpdate={onUpdateBill}
                  onRemove={onRemoveBill}
                />
              ))}

          {showAddBill ? (
            <div className="mt-2 flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                  placeholder={isIncome ? "Ex: Salario, Freelance..." : "Nome da conta"}
                  className="flex-1 bg-card text-foreground"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddBill()
                    if (e.key === "Escape") setShowAddBill(false)
                  }}
                />
                <Input
                  value={newBillAmount}
                  onChange={(e) => setNewBillAmount(e.target.value)}
                  placeholder="Valor (ex: 150,00)"
                  className="w-full bg-card text-foreground sm:w-36"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddBill()
                    if (e.key === "Escape") setShowAddBill(false)
                  }}
                />
              </div>
              <Input
                value={newBillNote}
                onChange={(e) => setNewBillNote(e.target.value)}
                placeholder="Observacao (opcional)"
                className="bg-card text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddBill()
                  if (e.key === "Escape") setShowAddBill(false)
                }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowAddBill(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddBill}>
                  Adicionar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 justify-start text-muted-foreground hover:text-foreground"
              onClick={() => setShowAddBill(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {addLabel}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Edit Category Dialog */}
      <Dialog open={showEditCategory} onOpenChange={setShowEditCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Categoria</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-name" className="text-foreground">
                Nome
              </Label>
              <Input
                id="cat-name"
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
                className="text-foreground"
              />
            </div>
            {!isIncome && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-split" className="text-foreground">
                  Dividir por (opcional)
                </Label>
                <Input
                  id="cat-split"
                  value={editCatSplit}
                  onChange={(e) => setEditCatSplit(e.target.value)}
                  placeholder="Ex: 2 para dividir por 2"
                  type="number"
                  min="1"
                  className="text-foreground"
                />
                <p className="text-xs text-muted-foreground">Deixe vazio para nao dividir o total</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCategory(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditCategory}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
