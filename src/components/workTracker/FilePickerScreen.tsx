import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FilePickerScreenProps {
  onChooseExisting: () => void;
  onCreateNew: () => void;
}

export default function FilePickerScreen({
  onChooseExisting,
  onCreateNew,
}: FilePickerScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm bg-card/80 shadow-xl backdrop-blur">
        <CardHeader>
          <CardTitle className="tracking-tight">Work Hours Tracker</CardTitle>
          <CardDescription>
            Choose where to store your data. The file can live in Dropbox,
            iCloud, or any folder you prefer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={onCreateNew}>
            Create new data file
          </Button>
          <Button variant="outline" className="w-full" onClick={onChooseExisting}>
            Open existing data file
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
