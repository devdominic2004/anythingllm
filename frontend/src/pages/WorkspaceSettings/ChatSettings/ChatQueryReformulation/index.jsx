export default function ChatQueryReformulation({ workspace, setHasChanges }) {
  return (
    <div className="flex flex-col gap-y-[8px]">
      <div className="flex flex-col gap-y-[8px]">
        <label htmlFor="queryReformulation" className="block input-label">
          Enable Query Reformulation (Multi-Query)
        </label>
        <p className="text-white text-opacity-60 text-xs font-medium">
          When enabled, the system will briefly pause before searching to detect if your prompt contains multiple distinct questions. 
          If it does, it will split them up and run multiple searches to ensure it finds all relevant information.
          <i> This may slightly increase response time and token usage.</i>
        </p>
      </div>
      <select
        name="queryReformulation"
        className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
        onChange={() => setHasChanges(true)}
        defaultValue={workspace?.queryReformulation ? "true" : "false"}
      >
        <option value="true">Enabled</option>
        <option value="false">Disabled (Default)</option>
      </select>
    </div>
  );
}
