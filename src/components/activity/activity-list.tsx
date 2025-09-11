"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, Search, RotateCcw, Activity } from "lucide-react";
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
  getMovementTypeIcon 
} from "@/lib/movements";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { useAuth } from "@/hooks/use-auth";
import { Timestamp } from "firebase/firestore";

interface ActivityListProps {
  activities?: Movement[];
  onRefresh?: () => void;
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
  "recurring_transaction_deleted"
];

export function ActivityList({ activities: propActivities, onRefresh, className }: ActivityListProps) {
  const { user } = useAuth();
  const formatCurrency = useCurrencyFormatter();
  
  const [activities, setActivities] = useState<Movement[]>(propActivities || []);
  const [loading, setLoading] = useState(!propActivities);
  const [filteredActivities, setFilteredActivities] = useState<Movement[]>([]);
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadActivities = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const { movements } = await getMovements(user.uid, 100);
      setActivities(movements);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterByType = async (type: MovementType) => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const movements = await getMovementsByType(user.uid, type);
      setActivities(movements);
    } catch (error) {
      console.error("Error filtering by type:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterByDateRange = async (from: Date, to: Date) => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const movements = await getMovementsByDateRange(user.uid, from, to);
      setActivities(movements);
    } catch (error) {
      console.error("Error filtering by date range:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(activity =>
        activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getMovementTypeLabel(activity.type).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.metadata?.accountName && activity.metadata.accountName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (activity.metadata?.goalName && activity.metadata.goalName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter(activity => activity.type === selectedType);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(activity => {
        const activityDate = activity.timestamp instanceof Timestamp 
          ? activity.timestamp.toDate() 
          : new Date(activity.timestamp);
        
        if (dateFrom && activityDate < dateFrom) return false;
        if (dateTo && activityDate > dateTo) return false;
        return true;
      });
    }

    setFilteredActivities(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedType("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleApplyDateRange = () => {
    if (dateFrom && dateTo) {
      handleFilterByDateRange(dateFrom, dateTo);
    }
  };

  // Load activities on mount if not provided via props
  useEffect(() => {
    if (!propActivities) {
      loadActivities();
    }
  }, [user?.uid, propActivities]);

  // Update local state when props change
  useEffect(() => {
    if (propActivities) {
      setActivities(propActivities);
    }
  }, [propActivities]);

  // Apply filters whenever activities or filter values change
  useEffect(() => {
    applyFilters();
  }, [activities, searchTerm, selectedType, dateFrom, dateTo]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentActivities = filteredActivities.slice(startIndex, endIndex);

  const getActivityColor = (type: MovementType) => {
    const colors = {
      account_created: "bg-green-100 text-green-800 border-green-200",
      account_updated: "bg-blue-100 text-blue-800 border-blue-200",
      account_deleted: "bg-red-100 text-red-800 border-red-200",
      transaction_created: "bg-purple-100 text-purple-800 border-purple-200",
      transaction_updated: "bg-indigo-100 text-indigo-800 border-indigo-200",
      transaction_deleted: "bg-red-100 text-red-800 border-red-200",
      transfer_created: "bg-orange-100 text-orange-800 border-orange-200",
      goal_created: "bg-emerald-100 text-emerald-800 border-emerald-200",
      goal_updated: "bg-teal-100 text-teal-800 border-teal-200",
      goal_deleted: "bg-red-100 text-red-800 border-red-200",
      goal_funds_added: "bg-cyan-100 text-cyan-800 border-cyan-200",
      recurring_transaction_created: "bg-violet-100 text-violet-800 border-violet-200",
      recurring_transaction_updated: "bg-pink-100 text-pink-800 border-pink-200",
      recurring_transaction_deleted: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Cargando actividades...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                  <div>
                    <div className="w-32 h-4 bg-gray-200 rounded animate-pulse mb-1" />
                    <div className="w-24 h-3 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </CardHeader>
        
        {showFilters && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar actividades..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div className="space-y-2">
                <Label>Tipo de Actividad</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {movementTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getMovementTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <Label>Desde</Label>
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
                      {dateFrom ? format(dateFrom, "PPP", { locale: es }) : "Fecha inicio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label>Hasta</Label>
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
                      {dateTo ? format(dateTo, "PPP", { locale: es }) : "Fecha fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex gap-2 mt-4">
              <Button 
                variant="secondary" 
                onClick={clearFilters}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar Filtros
              </Button>
              {onRefresh && (
                <Button 
                  variant="outline" 
                  onClick={onRefresh}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Actualizar
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Activities List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Actividades Recientes
              </CardTitle>
              <CardDescription>
                {filteredActivities.length} {filteredActivities.length === 1 ? 'actividad' : 'actividades'} encontrada{filteredActivities.length === 1 ? '' : 's'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay actividades</h3>
              <p className="text-muted-foreground">
                No se encontraron actividades con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentActivities.map((activity) => {
                const icon = getMovementTypeIcon(activity.type);
                const activityDate = activity.timestamp instanceof Timestamp 
                  ? activity.timestamp.toDate() 
                  : new Date(activity.timestamp);

                return (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
                        {icon}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{activity.description}</p>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getActivityColor(activity.type))}
                          >
                            {getMovementTypeLabel(activity.type)}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground">
                          <span>
                            {format(activityDate, "PPP 'a las' p", { locale: es })}
                          </span>
                          
                          {activity.metadata && (
                            <div className="flex flex-wrap gap-2 text-xs">
                              {activity.metadata.accountName && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                  📊 {activity.metadata.accountName}
                                </span>
                              )}
                              {activity.metadata.goalName && (
                                <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                                  🎯 {activity.metadata.goalName}
                                </span>
                              )}
                              {activity.metadata.amount && (
                                <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded font-mono">
                                  {formatCurrency.formatCurrency(activity.metadata.amount)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} 
                ({startIndex + 1}-{Math.min(endIndex, filteredActivities.length)} de {filteredActivities.length} actividades)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
