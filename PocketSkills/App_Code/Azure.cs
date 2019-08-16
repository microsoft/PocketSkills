using Microsoft.Azure.KeyVault;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Configuration;
using System.Web.WebPages.Html;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Table;
using Microsoft.IdentityModel.Clients.ActiveDirectory;

public static class Azure
{
    /// <summary>
    /// Stores the connection string to Azure storage, which is retrieved in the static constructor below.
    /// </summary>
    private static string StorageConnectionString;

    /// <summary>
    /// Initializes the <see cref="StorageConnectionString"/> from an Azure Key Value Secret or system environment variable.
    /// </summary>
    static Azure()
    {
        StorageConnectionString = Environment.GetEnvironmentVariable("StorageAccount");
        if (StorageConnectionString != null && StorageConnectionString.StartsWith("http")) // Can set this to an Azure KeyVault URL to get the connection string from Azure Key Vault.
        {
            var kv = new KeyVaultClient(async (string authority, string resource, string scope) =>
            {
                var authContext = new AuthenticationContext(authority);
                ClientCredential clientCred = new ClientCredential(
                            WebConfigurationManager.ConnectionStrings["ClientId"].ConnectionString,
                            WebConfigurationManager.ConnectionStrings["ClientSecret"].ConnectionString);
                AuthenticationResult result = await authContext.AcquireTokenAsync(resource, clientCred);

                if (result == null)
                    throw new InvalidOperationException("Failed to obtain the App Authentication JWT token");

                return result.AccessToken;
            });
            StorageConnectionString = kv.GetSecretAsync(StorageConnectionString).Result.Value;
        }

        if (String.IsNullOrWhiteSpace(StorageConnectionString))
        {
            throw new ConfigurationErrorsException("Set the StorageAccount environment variable or Azure application setting to your Azure storage connection string (e.g. DefaultEndpointsProtocol=https;AccountName=ACCOUNTNAME;AccountKey=ACCOUNTKEY)");
        }
    }

    /// <summary>
    /// Convenience method to perform a simple synchronous query a table.
    /// </summary>
    /// <param name="table">The name of the table to query.</param>
    /// <param name="queryString">The Azure/OData query string.</param>
    /// <returns>A list of query results.</returns>
    public static IList<DynamicTableEntity> Query(string table, string queryString)
    {
        var storage = CloudStorageAccount.Parse(StorageConnectionString);
        var client = storage.CreateCloudTableClient();
        var reference = client.GetTableReference(table);
        return reference.ExecuteQuery(new TableQuery().Where(queryString)).ToList();
    }

    /// <summary>
    /// Convenience method to perform a simple asynchronous query a table.
    /// </summary>
    /// <param name="table">The name of the table to query.</param>
    /// <param name="queryString">The Azure/OData query string.</param>
    /// <param name="onProgress">An optional callback method to call as query results are coming in.</param>
    /// <param name="onDone">An optional callback method to call when the query has completed.</param>
    /// <returns>A <see cref="Task"/> that when complete contains the list of query results.</returns>
    public static Task<IList<DynamicTableEntity>> QueryAsync(string table, string queryString, Action<IList<DynamicTableEntity>> onProgress = null, Action<IList<DynamicTableEntity>, bool> onDone = null)
    {
        var storage = CloudStorageAccount.Parse(StorageConnectionString);
        var client = storage.CreateCloudTableClient();
        var reference = client.GetTableReference(table);
        return reference.ExecuteQueryAsync(new TableQuery<DynamicTableEntity>().Where(queryString), default(CancellationToken), onProgress, onDone);
    }

    /// <summary>
    /// Private extension method that performs an asynchronous query to an Azure table and provides progress callbacks while executing an Azure query asynchronously.
    /// </summary>
    /// <typeparam name="T">The type of table entity being returned.</typeparam>
    /// <param name="table">The <see cref="CloudTable"/> to query.</param>
    /// <param name="query">The <see cref="TableQuery"/> to send to Azure.</param>
    /// <param name="ct">An optional <see cref="CancellationToken"/> that can be used to cancel the query.</param>
    /// <param name="onProgress">An optional callback method to call as query results are coming in.</param>
    /// <param name="onDone">An optional callback method to call when the query has completed.</param>
    /// <returns>A <see cref="Task"/> that when complete contains the list of query results.</returns>
    private static Task<IList<T>> ExecuteQueryAsync<T>(this CloudTable table, TableQuery<T> query, CancellationToken ct = default(CancellationToken), Action<IList<T>> onProgress = null, Action<IList<T>, bool> onDone = null) where T : ITableEntity, new()
    {
        return Task.Run(() =>
        {
            var runningQuery = new TableQuery<T>()
            {
                FilterString = query.FilterString,
                SelectColumns = query.SelectColumns
            };

            var items = new List<T>();
            TableContinuationToken token = null;

            do
            {
                runningQuery.TakeCount = query.TakeCount - items.Count;

                Debug.WriteLine("Executing Query [" + query.FilterString + "] with Continuation Token [" + token?.NextTableName + token?.NextPartitionKey + token?.NextRowKey + "]");
                TableQuerySegment<T> seg = table.ExecuteQuerySegmented<T>(runningQuery, token);
                token = seg.ContinuationToken;
                Debug.WriteLine("Query Returned " + seg.Results.Count + " Results, with new Continuation Token [" + seg.ContinuationToken?.NextTableName + seg.ContinuationToken?.NextPartitionKey + seg.ContinuationToken?.NextRowKey + "]");
                items.AddRange(seg);
                if (onProgress != null) onProgress(seg.Results);

            } while (token != null && !ct.IsCancellationRequested && (query.TakeCount == null || items.Count < query.TakeCount.Value));

            if (onDone != null) onDone(items, ct.IsCancellationRequested);

            return (IList<T>)items;
        });
    }

    /// <summary>
    /// A convenience method to get for a single entity in an Azure table.
    /// </summary>
    /// <param name="table">The name of the table containing the entity.</param>
    /// <param name="partitionKey">The partition key of the entity.</param>
    /// <param name="rowKey">The row key of the entity.</param>
    /// <returns>The entity matching the given <paramref name="partitionKey"/> and <paramref name="rowKey"/>, if any.</returns>
    public static DynamicTableEntity Get(string table, string partitionKey, string rowKey)
    {
        return Query(table,
            TableQuery.CombineFilters(
                TableQuery.GenerateFilterCondition("PartitionKey", QueryComparisons.Equal, partitionKey),
                TableOperators.And,
                TableQuery.GenerateFilterCondition("RowKey", QueryComparisons.Equal, rowKey))).FirstOrDefault();
    }

    /// <summary>
    /// A convenience method to set/insert a single entity in an Azure table.
    /// </summary>
    /// <param name="table">The name of the table that will contain the new entity.</param>
    /// <param name="partitionKey">The partition key of the entity.</param>
    /// <param name="rowKey">The row key of the entity.</param>
    /// <param name="properties">An object containing all of the other properties of the entity.</param>
    /// <returns>The result of the operation.</returns>
    public static TableResult Set(string table, string partitionKey, string rowKey, object properties = null)
    {
        var entity = new DynamicTableEntity(partitionKey, rowKey);
        if (properties != null)
        {
            foreach (var property in HtmlHelper.AnonymousObjectToHtmlAttributes(properties))
            {
                entity.Properties.Add(property.Key.Replace('-', '_'), EntityProperty.CreateEntityPropertyFromObject(property.Value));
            }
        }
        var storage = CloudStorageAccount.Parse(StorageConnectionString);
        var client = storage.CreateCloudTableClient();
        var reference = client.GetTableReference(table);
        return reference.Execute(TableOperation.InsertOrReplace(entity));
    }

    /// <summary>
    /// Gets a SAS URL that gives a user access to rows in a table for only that user.
    /// </summary>
    /// <param name="user">The user ID.</param>
    /// <param name="table">The name of the table to give access to.</param>
    /// <param name="query"><c>true</c> to allow query/read permission to the users' rows; otherwise, <c>false</c>.</param>
    /// <param name="add"><c>true</c> to allow add/insert permission to the users' rows; otherwise, <c>false</c>.</param>
    /// <param name="update"><c>true</c> to allow update/replace permission to the users' rows; otherwise, <c>false</c>.</param>
    /// <param name="delete"><c>true</c> to allow delete permission to the users' rows; otherwise, <c>false</c>.</param>
    /// <returns>A SAS URL that can be shared with the user.</returns>
    public static string GetTableSASForUser(string user, string table, bool query, bool add, bool update, bool delete)
    {
        return GetTableSAS(table, null, query, add, update, delete, user, user);
    }

    /// <summary>
    /// Private method to generate a SAS URL with given access and permissions.
    /// </summary>
    /// <param name="table">The name of the table to give access to.</param>
    /// <param name="policy">An optional name to create a named policy.</param>
    /// <param name="query"><c>true</c> to allow query/read permission; otherwise, <c>false</c>.</param>
    /// <param name="add"><c>true</c> to allow add/insert permission; otherwise, <c>false</c>.</param>
    /// <param name="update"><c>true</c> to allow update/replace permission; otherwise, <c>false</c>.</param>
    /// <param name="delete"><c>true</c> to allow delete permission; otherwise, <c>false</c>.</param>
    /// <param name="startPartitionKey">An optional starting partition key that will limit the range of accessible rows.</param>
    /// <param name="endPartitionKey">An optional ending partition key that will limit the range of accessible rows.</param>
    /// <param name="startRowKey">An optional starting row key that will limit the range of accessible rows.</param>
    /// <param name="endRowKey">An optional ending row key that will limit the range of accessible rows.</param>
    /// <param name="expiry">An optional <see cref="DateTimeOffset"/> that sets when the access will expire.</param>
    /// <returns>A SAS URL that can be shared to give the specified access to the table.</returns>
    private static string GetTableSAS(string table, string policy, bool query, bool add, bool update, bool delete, string startPartitionKey = null, string endPartitionKey = null, string startRowKey = null, string endRowKey = null, DateTimeOffset? expiry = null)
    {
        var storage = CloudStorageAccount.Parse(StorageConnectionString);
        var client = storage.CreateCloudTableClient();
        var reference = client.GetTableReference(table);
        var sas = new SharedAccessTablePolicy();
        sas.SharedAccessExpiryTime = expiry ?? DateTimeOffset.MaxValue;
        sas.Permissions =
            (query ? SharedAccessTablePermissions.Query : 0) |
            (add ? SharedAccessTablePermissions.Add : 0) |
            (update ? SharedAccessTablePermissions.Update : 0) |
            (delete ? SharedAccessTablePermissions.Delete : 0);
        if (!String.IsNullOrEmpty(policy))
        {
            // This will fail if the table doesn't exist.
            var permissions = reference.GetPermissions();
            var policies = permissions.SharedAccessPolicies;
            SharedAccessTablePolicy existing;
            if (!policies.TryGetValue(policy, out existing))
            {
                policies.Add(policy, existing = sas);
            }
            existing.SharedAccessExpiryTime = sas.SharedAccessExpiryTime;
            existing.Permissions = sas.Permissions;
            reference.SetPermissions(permissions);
            sas = new SharedAccessTablePolicy();
        }

        return reference.Uri + reference.GetSharedAccessSignature(sas, policy, startPartitionKey, startRowKey, endPartitionKey, endRowKey);
    }
}
