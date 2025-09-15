"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter, Search, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Movement,
  MovementType,
  getMovements,
  getMovementsByType,
  getMovementsByDateRange,
  getMovementTypeLabel,
  getMovementTypeIcon,
} from "@/lib/movements";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { useAuth } from "@/hooks/use-auth";
import { Timestamp } from "firebase/firestore";

interface MovementsListProps {
  className?: string;
}

const movementTypes: MovementType[] = [
  "account_created",
  "account_updated",
  "account_deleted",
  "transaction_created",
  "transaction_updated",
  "transaction_deleted",
  "transfer_created",
  "goal_created",
  "goal_updated",
  "goal_deleted",
  "goal_funds_added",
  "recurring_transaction_created",
  "recurring_transaction_updated",
  "recurring_transaction_deleted",
];

export function MovementsList({ className }: MovementsListProps) {
  const { user } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<MovementType | "all">("all");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadMovements = async (reset: boolean = false) => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      let result;

      if (dateFrom && dateTo) {
        // Filtrar por rango de fechas
        result = await getMovementsByDateRange(user.uid, dateFrom, dateTo);
        setMovements(result);
        setHasMore(false);
      } else if (selectedType !== "all") {
        // Filtrar por tipo
        result = await getMovementsByType(
          user.uid,
          selectedType as MovementType
        );
        setMovements(result);
        setHasMore(false);
      } else {
        // Cargar todos los movimientos con paginación
        const docToUse = reset ? null : lastDoc;
        const { movements: newMovements, lastDocument } = await getMovements(
          user.uid,
          50,
          docToUse
        );

        if (reset) {
          setMovements(newMovements);
        } else {
          setMovements((prev) => [...prev, ...newMovements]);
        }

        setLastDoc(lastDocument);
        setHasMore(newMovements.length === 50);
      }
    } catch (error) {
      console.error("Error loading movements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements(true);
  }, [user?.uid, selectedType, dateFrom, dateTo]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedType("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setLastDoc(null);
  };

  const filteredMovements = movements.filter((movement) => {
    if (!searchTerm) return true;
    return movement.description
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
  });

  const formatDate = (date: Date | string | Timestamp) => {
    let d: Date;
    if (typeof date === "string") {
      d = new Date(date);
    } else if (date instanceof Timestamp) {
      d = date.toDate();
    } else {
      d = date;
    }
    return format(d, "dd/MM/yyyy 'a las' HH:mm", { locale: es });
  };

  const getMovementColor = (type: MovementType) => {
    if (type.includes("created"))
      return "bg-green-100 text-green-800 border-green-200";
    if (type.includes("updated"))
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (type.includes("deleted"))
      return "bg-red-100 text-red-800 border-red-200";
    if (type === "transfer_created")
      return "bg-purple-100 text-purple-800 border-purple-200";
    if (type.includes("goal"))
      return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Movimientos
          </CardTitle>
          <CardDescription>
            Filtra y busca en tu historial de actividades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar en descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Tipo de movimiento */}
            <div className="space-y-2">
              <Label>Tipo de Movimiento</Label>
              <Select
                value={selectedType}
                onValueChange={(value) =>
                  setSelectedType(value as MovementType | "all")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {movementTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getMovementTypeIcon(type)} {getMovementTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha desde */}
            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom
                      ? format(dateFrom, "dd/MM/yyyy")
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Fecha hasta */}
            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo
                      ? format(dateTo, "dd/MM/yyyy")
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Lista de movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Movimientos</CardTitle>
          <CardDescription>
            {filteredMovements.length} movimiento
            {filteredMovements.length !== 1 ? "s" : ""} encontrado
            {filteredMovements.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                <span>Cargando movimientos...</span>
              </div>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="mb-4">📋</div>
              <p>No se encontraron movimientos</p>
              <p className="text-sm">
                Ajusta los filtros o realiza algunas acciones en la aplicación
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="text-2xl mt-1">
                    {getMovementTypeIcon(movement.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm leading-relaxed">
                          {movement.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(movement.timestamp)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            getMovementColor(movement.type)
                          )}
                        >
                          {getMovementTypeLabel(movement.type)}
                        </Badge>

                        {movement.amount && movement.currency && (
                          <span className="text-sm font-medium">
                            {formatCurrency(movement.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata adicional */}
                    {movement.metadata &&
                      Object.keys(movement.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {movement.fromAccount && movement.toAccount && (
                            <span>
                              De: {movement.metadata.fromAccountName} → A:{" "}
                              {movement.metadata.toAccountName}
                            </span>
                          )}
                          {movement.metadata.category && (
                            <span className="ml-2">
                              Categoría: {movement.metadata.category}
                            </span>
                          )}
                          {movement.metadata.accountName && (
                            <span>Cuenta: {movement.metadata.accountName}</span>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              ))}

              {/* Cargar más */}
              {hasMore && selectedType === "all" && !dateFrom && !dateTo && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => loadMovements(false)}
                    disabled={loading}
                  >
                    {loading ? "Cargando..." : "Cargar más movimientos"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
