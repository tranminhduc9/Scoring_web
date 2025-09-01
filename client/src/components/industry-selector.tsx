import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { getAllIndustries, getIndustriesByLevel, type IndustryLevel } from "@/lib/industry-parser";

interface IndustrySelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  "data-testid"?: string;
  availableIndustries?: string[];
  showOnlyAvailable?: boolean;
  onShowOnlyAvailableChange?: (checked: boolean) => void;
}

export default function IndustrySelector({ 
  value = [], 
  onValueChange, 
  placeholder = "Chọn mã ngành...",
  "data-testid": testId,
  availableIndustries = [],
  showOnlyAvailable = false,
  onShowOnlyAvailableChange
}: IndustrySelectorProps) {
  const [open, setOpen] = useState(false);
  const [industries, setIndustries] = useState<IndustryLevel[]>([]);
  const [loading, setLoading] = useState(true);

  // Load embedded industry data
  useEffect(() => {
    try {
      const parsedIndustries = getAllIndustries();
      console.log('Loaded embedded industries:', parsedIndustries.length);
      setIndustries(parsedIndustries);
    } catch (error) {
      console.error('Failed to load embedded industry data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter industries based on availability
  const filteredIndustries = useMemo(() => {
    if (!showOnlyAvailable || availableIndustries.length === 0) {
      return industries;
    }
    return industries.filter(industry => 
      availableIndustries.includes(industry.apiCode) || 
      availableIndustries.includes(industry.code)
    );
  }, [industries, showOnlyAvailable, availableIndustries]);

  // Group industries by level for better display
  const industriesByLevel = useMemo(() => {
    return getIndustriesByLevel(filteredIndustries);
  }, [filteredIndustries]);

  const selectedIndustries = industries.filter(industry => value.includes(industry.apiCode));

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return "Level 1 - Ngành chính";
      case 2: return "Level 2 - Phân ngành";
      case 3: return "Level 3 - Nhóm";
      case 4: return "Level 4 - Lớp";
      case 5: return "Level 5 - Tiểu lớp";
      default: return `Level ${level}`;
    }
  };

  if (loading) {
    return (
      <Button
        variant="outline"
        role="combobox"
        disabled
        className="w-full justify-between"
        data-testid={testId}
      >
        Đang tải...
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid={testId}
        >
          {selectedIndustries.length > 0 ? (
            <div className="flex items-center space-x-2 truncate">
              <Badge variant="secondary" className="text-xs">
                {selectedIndustries.length} mã đã chọn
              </Badge>
              <span className="truncate">
                {selectedIndustries.map(ind => ind.apiCode).join(", ")}
              </span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <div className="border-b">
            <div className="flex items-center px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Tìm kiếm theo mã hoặc tên ngành..."
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            
            {/* Availability filter checkbox inside dropdown */}
            {availableIndustries.length > 0 && onShowOnlyAvailableChange && (
              <div className="flex items-center space-x-2 px-3 py-2 border-t bg-muted/30">
                <Checkbox
                  id="show-only-available-dropdown"
                  checked={showOnlyAvailable}
                  onCheckedChange={onShowOnlyAvailableChange}
                />
                <Label htmlFor="show-only-available-dropdown" className="text-sm text-muted-foreground cursor-pointer">
                  Chỉ hiển thị mã ngành có trong danh sách ({availableIndustries.length} mã)
                </Label>
              </div>
            )}
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Không tìm thấy ngành nghề nào.</CommandEmpty>
            
            {Object.entries(industriesByLevel)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([level, levelIndustries]) => (
                <CommandGroup key={level} heading={getLevelLabel(parseInt(level))}>
                  {levelIndustries.map((industry) => (
                    <CommandItem
                      key={industry.code}
                      value={`${industry.code} ${industry.name}`}
                      onSelect={() => {
                        const isSelected = value.includes(industry.apiCode);
                        const newValue = isSelected 
                          ? value.filter(code => code !== industry.apiCode)
                          : [...value, industry.apiCode];
                        onValueChange(newValue);
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        checked={value.includes(industry.apiCode)}
                        className="mr-2 h-4 w-4"
                      />
                      <Badge variant="outline" className="text-xs">
                        {industry.apiCode}
                      </Badge>
                      <span className="flex-1 truncate">{industry.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
