import argparse
import sqlite3
import numpy as np

def view_data(db_file, row_id, show_embedding):
    """
    Connects to the SQLite database, retrieves and prints either the embedding or the chunk text
    for a given row ID.
    """
    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(db_file)
        conn.enable_load_extension(True)
        conn.load_extension('./node_modules/sqlite-vss-linux-x64/lib/vector0.so')
        conn.load_extension('./node_modules/sqlite-vss-linux-x64/lib/vss0.so')
        cursor = conn.cursor()

        if show_embedding:
            # Query the vss_embeddings table for the specified row ID
            cursor.execute("SELECT embedding FROM vss_embeddings WHERE rowid = ?", (row_id,))
            result = cursor.fetchone()

            if result:
                embedding_blob = result[0]
                if embedding_blob is None:
                    print(f"Embedding data for row ID {row_id} is NULL or empty.")
                    return
                
                embedding = np.frombuffer(embedding_blob, dtype=np.float32)
                
                print(f"Embedding for row ID {row_id}:")
                np.set_printoptions(threshold=np.inf) # Set threshold to infinity to print full array
                print(embedding)
                np.set_printoptions(threshold=1000) # Reset to default or a reasonable value afterwards
            else:
                print(f"No embedding found for row ID {row_id}.")
        else:
            # Query the chunks table for the specified row ID
            cursor.execute("SELECT content FROM chunks WHERE rowid = ?", (row_id,))
            result = cursor.fetchone()

            if result:
                chunk_content = result[0]
                print(f"Chunk content for row ID {row_id}:")
                print(chunk_content)
            else:
                print(f"No chunk content found for row ID {row_id}.")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="View embedding or chunk text from the data.db file.")
    parser.add_argument("-d", "--database", required=True, help="Path to the database file (e.g., data.db)")
    parser.add_argument("-r", "--rowid", required=True, type=int, help="The row ID of the data to view")
    parser.add_argument("-e", "--embedding", action="store_true", help="Show embedding (default is chunk text)")

    args = parser.parse_args()

    view_data(args.database, args.rowid, args.embedding)
